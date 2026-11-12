/**
 * Locket Gold VIP - Firebase Cloud Firestore & Auth Integration Module
 * Hỗ trợ lưu trữ CSDL thời gian thực: Tài khoản, Số dư Xu, Lịch sử nạp và Đơn mua gói.
 * Có cơ chế tự động Fallback sang LocalStorage nếu chưa cấu hình Firebase.
 */

// CẤU HÌNH FIREBASE CỦA BẠN (Dự án: locket-gold-85462)
var firebaseConfig = {
    apiKey: "AIzaSyASU-0pK1uWrzkVeQMCpxrR-jcfZuMJPHI",
    authDomain: "locket-gold-85462.firebaseapp.com",
    projectId: "locket-gold-85462",
    storageBucket: "locket-gold-85462.firebasestorage.app",
    messagingSenderId: "538965240283",
    appId: "1:538965240283:web:4e20ecb04b284ae3d9dffe",
    measurementId: "G-0E3ZLC29DN"
};

// Kiểm tra xem cấu hình đã được thay thế bằng key thật chưa
function isFirebaseConfigured() {
    return firebaseConfig && 
           firebaseConfig.apiKey && 
           firebaseConfig.apiKey !== "AIzaSyYOUR_API_KEY_HERE" && 
           firebaseConfig.projectId !== "locket-gold-vip";
}

var firebaseApp = null;
var firestoreDB = null;
var firebaseAuth = null;
var isUsingCloudDB = false;

// Khởi tạo Firebase SDK
function initFirebase() {
    if (isFirebaseConfigured() && typeof firebase !== "undefined") {
        try {
            if (!firebase.apps.length) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
            } else {
                firebaseApp = firebase.app();
            }
            firestoreDB = firebase.firestore();
            firebaseAuth = firebase.auth();
            isUsingCloudDB = true;
            console.log("✅ [Firebase] Đã kết nối thành công Cloud Firestore & Authentication!");
            return true;
        } catch (err) {
            console.warn("⚠️ [Firebase] Lỗi khởi tạo Firebase, chuyển sang Local DB:", err);
            isUsingCloudDB = false;
            return false;
        }
    } else {
        isUsingCloudDB = false;
        console.log("ℹ️ [Database] Đang sử dụng Local Storage Engine (Chờ cấu hình Firebase Config).");
        return false;
    }
}

// =========================================================================
// 1. TÀI KHOẢN & ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU (USERS & AUTH)
// =========================================================================

// Danh sách Email mặc định có đặc quyền Quản Trị Viên Tối Cao (Master Root Admin)
var DEFAULT_ADMIN_EMAILS = [
    'tranvannguyen991@gmail.com',
    'admin@locketgold.com'
];

// Hàm kiểm tra tài khoản có quyền Quản Trị Viên hay không
function checkIsAdmin(userOrEmail) {
    if (!userOrEmail) return false;
    var email = '';
    var role = '';
    if (typeof userOrEmail === 'string') {
        email = userOrEmail.trim().toLowerCase();
    } else if (typeof userOrEmail === 'object') {
        email = (userOrEmail.email || '').trim().toLowerCase();
        role = (userOrEmail.role || '').toLowerCase();
    }

    // Nếu tài khoản đã bị hạ quyền tường minh về 'user':
    // Chỉ bảo vệ duy nhất tài khoản gốc tranvannguyen991@gmail.com không bao giờ bị hạ nhầm
    if (role === 'user' && email !== 'tranvannguyen991@gmail.com') {
        return false;
    }
    if (role === 'admin') return true;

    // Email Quản Trị Viên gốc mặc định
    if (DEFAULT_ADMIN_EMAILS.some(function(adm) { return adm.toLowerCase() === email; })) {
        return true;
    }

    // Kiểm tra danh sách Admin được cấp quyền
    try {
        var custom = JSON.parse(localStorage.getItem('locket_custom_admin_emails') || '[]');
        if (Array.isArray(custom) && custom.map(function(e) { return (e || '').toLowerCase(); }).includes(email)) {
            return true;
        }
    } catch(e) {}
    return false;
}

if (typeof window !== 'undefined') {
    window.checkIsAdmin = checkIsAdmin;
    window.DEFAULT_ADMIN_EMAILS = DEFAULT_ADMIN_EMAILS;
}

// Tiện ích timeout để không bao giờ bị treo quá 2 giây
function runWithTimeout(promise, ms) {
    return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
            reject(new Error('TIMEOUT'));
        }, ms || 2000);
        promise.then(function(res) {
            clearTimeout(timer);
            resolve(res);
        }).catch(function(err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// Đăng nhập tài khoản (Kiểm tra cả Local Storage & Cloud Firestore thời gian thực)
async function dbLoginUser(email, password) {
    email = (email || '').trim().toLowerCase();
    password = (password || '').trim();

    if (!email) {
        return { success: false, error: 'Vui lòng nhập địa chỉ email của bạn!' };
    }
    if (!password) {
        return { success: false, error: 'Vui lòng nhập mật khẩu đăng nhập!' };
    }

    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    var localUser = matchedKey ? localUsers[matchedKey] : null;

    // 1. Kiểm tra nhanh trong Local Storage nếu có và đúng mật khẩu
    if (localUser && localUser.password && localUser.password === password) {
        var isLocalAdmin = (localUser.role === 'admin') || (typeof checkIsAdmin === "function" && checkIsAdmin(localUser));
        localUser.role = isLocalAdmin ? 'admin' : 'user';
        localUsers[matchedKey] = localUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

        // Nạp thêm bản mới nhất từ Cloud Firestore trong nền nếu có
        if (isUsingCloudDB && firestoreDB) {
            firestoreDB.collection('users').where('email', '==', email).get().then(function(snap) {
                if (!snap.empty) {
                    var latest = snap.docs[0].data();
                    var merged = Object.assign({}, localUser, latest);
                    localUsers[matchedKey] = merged;
                    localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                }
            }).catch(function(){});
        }
        return { success: true, user: localUser };
    }

    // 2. Tra cứu trực tiếp trên Cloud Firestore (Đảm bảo luôn tìm thấy tài khoản trên thiết bị mới / Vercel)
    if (isUsingCloudDB && firestoreDB) {
        try {
            var cloudUser = null;
            var cloudDocRef = null;

            // Truy vấn chính xác theo email
            var snap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 3000);
            if (!snap.empty) {
                cloudUser = snap.docs[0].data();
                cloudDocRef = snap.docs[0].ref;
            } else {
                // Fallback: Quét case-insensitive nếu email lưu chữ hoa chữ thường
                var allSnap = await runWithTimeout(firestoreDB.collection('users').get(), 3000);
                allSnap.forEach(function(doc) {
                    var d = doc.data();
                    if (d && (d.email || '').trim().toLowerCase() === email) {
                        cloudUser = d;
                        cloudDocRef = doc.ref;
                    }
                });
            }

            if (cloudUser) {
                // Kiểm tra mật khẩu tài khoản
                if (cloudUser.password && cloudUser.password !== password) {
                    return { 
                        success: false, 
                        error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại hoặc bấm "Quên mật khẩu?"' 
                    };
                }

                // Nếu tài khoản trên Firestore chưa có trường mật khẩu, lưu luôn mật khẩu vừa nhập
                if (!cloudUser.password) {
                    cloudUser.password = password;
                    if (cloudDocRef) {
                        cloudDocRef.update({ password: password }).catch(function(){});
                    }
                }

                // Xác định quyền Admin hoặc Khách Hàng
                var isCloudAdmin = (cloudUser.role === 'admin') || (typeof checkIsAdmin === "function" && checkIsAdmin(cloudUser));
                cloudUser.role = isCloudAdmin ? 'admin' : 'user';

                // Đồng bộ và lưu cache vào Local Storage
                localUsers[email] = cloudUser;
                localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

                return { success: true, user: cloudUser };
            }
        } catch(cloudErr) {
            console.warn("Firestore dbLoginUser lookup warn:", cloudErr);
        }
    }

    // 3. Nếu tài khoản có trong Local Storage nhưng sai mật khẩu
    if (localUser && localUser.password && localUser.password !== password) {
        return { 
            success: false, 
            error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại hoặc bấm "Quên mật khẩu?"' 
        };
    }

    // 4. Thử qua Firebase Auth nếu được kích hoạt
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCredential = await runWithTimeout(firebaseAuth.signInWithEmailAndPassword(email, password), 2500);
            var uid = userCredential.user.uid;
            var isAdminRole = checkIsAdmin(email);
            
            var defaultData = {
                uid: uid,
                name: userCredential.user.displayName || email.split('@')[0],
                email: email,
                password: password,
                role: isAdminRole ? 'admin' : 'user',
                balance: 0,
                code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
                packages: [],
                history: [],
                createdAt: new Date().toISOString()
            };

            localUsers[email] = defaultData;
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

            if (firestoreDB) {
                firestoreDB.collection('users').doc(uid).set(defaultData, { merge: true }).catch(function(){});
            }

            return { success: true, user: defaultData };
        } catch (err) {
            console.warn("Firebase Auth signIn catch:", err.code || err.message);

            if (err.code === 'auth/wrong-password') {
                return { success: false, error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại hoặc bấm Quên mật khẩu.' };
            }
        }
    }

    // 5. Nếu không tìm thấy ở bất cứ đâu
    return { 
        success: false, 
        error: 'Tài khoản chưa tồn tại hoặc sai thông tin! Vui lòng kiểm tra lại hoặc bấm tab Đăng Ký để tạo tài khoản mới.' 
    };
}

// Đăng ký tài khoản mới (Siêu tốc & Chống treo tuyệt đối)
async function dbRegisterUser(name, email, password) {
    email = (email || '').trim().toLowerCase();

    // 1. Kiểm tra tồn tại trong Local Storage (0.001s)
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    if (matchedKey) {
        return { success: false, error: 'Email này đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập.' };
    }

    var uid = 'usr_' + Date.now();
    var userRole = checkIsAdmin(email) ? 'admin' : 'user';
    var newUserData = {
        uid: uid,
        name: name || email.split('@')[0],
        email: email,
        password: password,
        role: userRole,
        balance: 0,
        code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
        packages: [],
        history: [],
        createdAt: new Date().toISOString()
    };

    // 2. Nếu có Firebase Auth, thử tạo tài khoản trên Cloud (timeout tối đa 2.5s)
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCred = await runWithTimeout(firebaseAuth.createUserWithEmailAndPassword(email, password), 2500);
            newUserData.uid = userCred.user.uid;
            if (userCred.user && userCred.user.updateProfile) {
                userCred.user.updateProfile({ displayName: name }).catch(function(){});
            }
        } catch (err) {
            console.warn("Firebase Auth createUser fallback:", err.code || err.message);
            if (err.code === 'auth/email-already-in-use') {
                return { success: false, error: 'Email này đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập hoặc Quên mật khẩu.' };
            } else if (err.code === 'auth/weak-password') {
                return { success: false, error: 'Mật khẩu quá ngắn! Mật khẩu phải có ít nhất 6 ký tự.' };
            } else if (err.code === 'auth/invalid-email') {
                return { success: false, error: 'Địa chỉ email không đúng định dạng!' };
            }
            // Các lỗi khác (auth/configuration-not-found, TIMEOUT, mạng chậm) -> tự động bypass sang lưu Firestore/Local
        }
    }

    // 3. Ghi vào Cloud Firestore trong nền (Non-blocking - KHÔNG AWAIT để không bị đơ)
    if (isUsingCloudDB && firestoreDB) {
        firestoreDB.collection('users').doc(newUserData.uid).set(newUserData).catch(function(e) {
            console.warn("Firestore background write warn:", e);
        });
    }

    // 4. Lưu vào LocalStorage ngay lập tức
    localUsers[email] = newUserData;
    localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

    return { success: true, user: newUserData };
}

// =========================================================================
// QUÊN MẬT KHẨU QUA MÃ XÁC NHẬN OTP (EMAIL OTP FORGOT PASSWORD)
// =========================================================================

// 1. Gửi mã OTP 6 số đến Email khách hàng
async function dbSendPasswordResetOtp(email) {
    email = (email || '').trim().toLowerCase();
    if (!email) return { success: false, error: 'Vui lòng nhập địa chỉ email của bạn!' };

    // Kiểm tra tài khoản có tồn tại không (trong LocalStorage hoặc Cloud Firestore)
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    var matchedUser = matchedKey ? localUsers[matchedKey] : null;

    if (!matchedUser && isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 2500);
            if (!userSnap.empty) {
                matchedUser = userSnap.docs[0].data();
            }
        } catch(e) {}
    }

    if (!matchedUser) {
        return { 
            success: false, 
            error: 'Không tìm thấy tài khoản nào với email: ' + email + '. Vui lòng kiểm tra lại hoặc chuyển sang tab Đăng Ký!' 
        };
    }

    // Tạo mã OTP ngẫu nhiên 6 chữ số
    var otp = Math.floor(100000 + Math.random() * 900000).toString();
    var expiresAt = Date.now() + 5 * 60 * 1000; // Hết hạn sau 5 phút

    var otpRecord = {
        email: email,
        otp: otp,
        expiresAt: expiresAt,
        createdAt: new Date().toISOString()
    };

    // Lưu OTP vào SessionStorage và LocalStorage
    try {
        sessionStorage.setItem('locket_reset_otp_' + email, JSON.stringify(otpRecord));
        localStorage.setItem('locket_last_otp_' + email, JSON.stringify(otpRecord));
    } catch(e) {}

    // Lưu OTP lên Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            firestoreDB.collection('password_resets').doc(email).set(otpRecord).catch(function(){});
        } catch(e) {}
    }

    // Gửi email thực tế qua FormSubmit service (miễn phí, không cần cấu hình backend)
    try {
        fetch('https://formsubmit.co/ajax/' + encodeURIComponent(email), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                _subject: '[Locket Gold VIP] Mã OTP Khôi Phục Mật Khẩu: ' + otp,
                'Email Khách Hàng': email,
                'Mã OTP Xác Nhận': otp,
                'Thời Hạn Mã': '5 Phút (Kể từ thời điểm nhận mail)',
                'Cảnh Báo Bảo Mật': 'Tuyệt đối không cung cấp mã OTP này cho bất kỳ ai để bảo vệ tài khoản.'
            })
        }).catch(function(err) {
            console.warn("FormSubmit email warn:", err);
        });
    } catch(e) {}

    // Nếu có Firebase Auth, kích hoạt song song mail reset của Google
    if (isUsingCloudDB && firebaseAuth) {
        try {
            firebaseAuth.sendPasswordResetEmail(email).catch(function(){});
        } catch(e) {}
    }

    console.log("🔑 [Locket Gold] Mã OTP khôi phục mật khẩu của " + email + " là: " + otp);

    return { 
        success: true, 
        email: email, 
        otp: otp, 
        expiresAt: expiresAt,
        message: 'Mã xác nhận OTP 6 số đã được gửi đến email ' + email + '!'
    };
}

// 2. Xác thực OTP và Đổi mật khẩu mới
async function dbVerifyOtpAndChangePassword(email, otp, newPassword) {
    email = (email || '').trim().toLowerCase();
    otp = (otp || '').trim();

    if (!email) return { success: false, error: 'Thiếu thông tin email!' };
    if (!otp) return { success: false, error: 'Vui lòng nhập mã OTP 6 chữ số!' };
    if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' };
    }

    // 1. Lấy mã OTP đã lưu
    var storedOtp = null;
    try {
        var sess = sessionStorage.getItem('locket_reset_otp_' + email);
        if (sess) storedOtp = JSON.parse(sess);
        if (!storedOtp) {
            var loc = localStorage.getItem('locket_last_otp_' + email);
            if (loc) storedOtp = JSON.parse(loc);
        }
    } catch(e) {}

    // Kiểm tra trên Cloud Firestore nếu chưa có ở local
    if (!storedOtp && isUsingCloudDB && firestoreDB) {
        try {
            var docSnap = await runWithTimeout(firestoreDB.collection('password_resets').doc(email).get(), 2500);
            if (docSnap.exists) {
                storedOtp = docSnap.data();
            }
        } catch(e) {}
    }

    if (!storedOtp) {
        return { success: false, error: 'Mã OTP chưa được gửi hoặc đã hết hạn. Vui lòng bấm Gửi lại mã OTP!' };
    }

    // Kiểm tra hết hạn (quá 5 phút)
    if (Date.now() > storedOtp.expiresAt) {
        return { success: false, error: 'Mã OTP này đã hết hạn (chỉ có hiệu lực trong 5 phút). Vui lòng bấm Gửi lại mã mới!' };
    }

    // So khớp mã OTP
    if (storedOtp.otp !== otp) {
        return { success: false, error: 'Mã OTP không chính xác! Vui lòng kiểm tra lại email của bạn.' };
    }

    // 2. OTP hợp lệ! Cập nhật mật khẩu mới trong Local Storage
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    if (matchedKey) {
        localUsers[matchedKey].password = newPassword;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
    }

    // 3. Cập nhật mật khẩu mới lên Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 2500);
            if (!userSnap.empty) {
                await userSnap.docs[0].ref.update({ password: newPassword });
            }
            firestoreDB.collection('password_resets').doc(email).update({ used: true, usedAt: new Date().toISOString() }).catch(function(){});
        } catch(e) {
            console.warn("Firestore update pass warn:", e);
        }
    }

    // Hủy mã OTP sau khi đổi thành công để bảo mật
    try {
        sessionStorage.removeItem('locket_reset_otp_' + email);
        localStorage.removeItem('locket_last_otp_' + email);
    } catch(e) {}

    return { 
        success: true, 
        message: 'Đổi mật khẩu thành công! Bạn có thể dùng mật khẩu mới để đăng nhập ngay.' 
    };
}

// Khôi phục mật khẩu tương thích ngược
async function dbResetPassword(email) {
    return await dbSendPasswordResetOtp(email);
}

// Lắng nghe dữ liệu thời gian thực (Realtime onSnapshot)
function dbSubscribeUser(userId, onUpdate) {
    if (isUsingCloudDB && firestoreDB && userId) {
        return firestoreDB.collection('users').doc(userId).onSnapshot(function(doc) {
            if (doc.exists) {
                onUpdate(doc.data());
            }
        }, function(error) {
            console.error("Lỗi realtime sync:", error);
        });
    }
    return null;
}

// =========================================================================
// 2. NẠP XU (RECHARGES / INVOICES)
// =========================================================================

// Tạo đơn nạp tiền mới (Trạng thái mặc định: Chờ duyệt - KHÔNG TỰ ĐỘNG CỘNG XU)
async function dbCreateRecharge(rechargeData) {
    rechargeData.status = 'Chờ duyệt';
    
    // 1. Lưu vào Local Storage
    try {
        var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        localRecharges.unshift(rechargeData);
        localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));

        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        var userEmail = (rechargeData.userEmail || '').toLowerCase();
        var matchedKey = Object.keys(localUsers).find(function(k) {
            return k.toLowerCase() === userEmail;
        });
        if (matchedKey) {
            localUsers[matchedKey].history = localUsers[matchedKey].history || [];
            localUsers[matchedKey].history.unshift({
                id: rechargeData.id,
                type: 'recharge',
                title: 'Nạp Xu VietQR (MB Bank)',
                amount: '+ ' + rechargeData.xu + ' Xu (' + (rechargeData.amountVnd || rechargeData.xu * 1000).toLocaleString('vi-VN') + ' đ)',
                date: rechargeData.date,
                status: 'Chờ duyệt'
            });
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        }
    } catch(e) {
        console.warn("Local dbCreateRecharge write warn:", e);
    }

    // 2. Lưu vào Cloud Firestore trong nền (Non-blocking)
    if (isUsingCloudDB && firestoreDB) {
        try {
            firestoreDB.collection('recharges').doc(rechargeData.id).set(rechargeData).catch(function(e) {
                console.warn("Firestore recharge set error:", e);
            });
            if (rechargeData.userId) {
                var userRef = firestoreDB.collection('users').doc(rechargeData.userId);
                userRef.update({
                    history: firebase.firestore.FieldValue.arrayUnion({
                        id: rechargeData.id,
                        type: 'recharge',
                        title: 'Nạp Xu VietQR (MB Bank)',
                        amount: '+ ' + rechargeData.xu + ' Xu (' + (rechargeData.amountVnd || rechargeData.xu * 1000).toLocaleString('vi-VN') + ' đ)',
                        date: rechargeData.date,
                        status: 'Chờ duyệt'
                    })
                }).catch(function(){});
            }
        } catch(e) {}
    }

    return { success: true };
}

// =========================================================================
// 3. MUA GÓI LOCKET GOLD (ORDERS)
// =========================================================================

async function dbCreateOrder(orderData) {
    // orderData: { id, userId, userEmail, pkgType, pkgName, priceXu, date, expires, status }
    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('orders').doc(orderData.id).set(orderData);
            var userRef = firestoreDB.collection('users').doc(orderData.userId);
            await userRef.update({
                balance: firebase.firestore.FieldValue.increment(-orderData.priceXu),
                packages: firebase.firestore.FieldValue.arrayUnion({
                    id: 'PKG-' + Math.floor(10000 + Math.random() * 90000),
                    type: orderData.pkgType,
                    name: orderData.pkgName,
                    date: orderData.date,
                    expires: orderData.expires
                }),
                history: firebase.firestore.FieldValue.arrayUnion({
                    id: orderData.id,
                    type: 'order',
                    title: 'Mua ' + orderData.pkgName,
                    amount: '- ' + orderData.priceXu + ' Xu',
                    date: orderData.date,
                    status: 'Đã kích hoạt'
                })
            });
            return { success: true };
        } catch (err) {
            console.error("Lỗi ghi order Firestore:", err);
            return { success: false, error: err.message };
        }
    } else {
        // Local DB
        var localOrders = JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');
        localOrders.unshift(orderData);
        localStorage.setItem('locket_gold_orders_db', JSON.stringify(localOrders));
        return { success: true };
    }
}

// =========================================================================
// 4. DANH SÁCH DÀNH CHO ADMIN / QUẢN TRỊ VIÊN
// =========================================================================


// Lấy toàn bộ đơn nạp tiền (Hợp nhất Cloud Firestore + Local Storage)
async function dbAdminGetAllRecharges() {
    var itemMap = {};
    
    // 1. Nạp từ Local Storage trước
    try {
        var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        localRecharges.forEach(function(r) {
            if (r && r.id) itemMap[r.id] = r;
        });
    } catch(e) {}

    // 2. Nạp thêm từ Cloud Firestore nếu có
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await runWithTimeout(firestoreDB.collection('recharges').get(), 2500);
            snapshot.forEach(function(doc) {
                var d = doc.data();
                if (d && d.id) itemMap[d.id] = Object.assign(itemMap[d.id] || {}, d);
            });
        } catch(e) {
            console.warn("Firestore dbAdminGetAllRecharges fallback:", e);
        }
    }

    var list = Object.values(itemMap);
    return list.reverse();
}

// Lấy toàn bộ đơn mua gói (Hợp nhất Cloud Firestore + Local Storage)
async function dbAdminGetAllOrders() {
    var itemMap = {};

    // 1. Nạp từ Local Storage trước
    try {
        var localOrders = JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');
        localOrders.forEach(function(o) {
            if (o && o.id) itemMap[o.id] = o;
        });
    } catch(e) {}

    // 2. Nạp thêm từ Cloud Firestore nếu có
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await runWithTimeout(firestoreDB.collection('orders').get(), 2500);
            snapshot.forEach(function(doc) {
                var d = doc.data();
                if (d && d.id) itemMap[d.id] = Object.assign(itemMap[d.id] || {}, d);
            });
        } catch(e) {
            console.warn("Firestore dbAdminGetAllOrders fallback:", e);
        }
    }

    var list = Object.values(itemMap);
    return list.reverse();
}

// Duyệt nạp tiền (Cộng Xu cho khách)
async function dbAdminApproveRecharge(rechargeId, userEmail, xu) {
    userEmail = (userEmail || '').trim().toLowerCase();
    
    // 1. Cập nhật Local Storage
    var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
    localRecharges.forEach(function(r) {
        if (r.id === rechargeId) r.status = 'Thành công';
    });
    localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));

    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === userEmail;
    });
    if (matchedKey) {
        localUsers[matchedKey].balance = (localUsers[matchedKey].balance || 0) + xu;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
    }

    // 2. Cập nhật Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('recharges').doc(rechargeId).update({
                status: 'Thành công'
            }).catch(function(){});
            var userSnap = await firestoreDB.collection('users').where('email', '==', userEmail).get();
            if (!userSnap.empty) {
                var uDoc = userSnap.docs[0];
                await uDoc.ref.update({
                    balance: firebase.firestore.FieldValue.increment(xu)
                }).catch(function(){});
            }
        } catch(e) {
            console.warn("Firestore dbAdminApproveRecharge warn:", e);
        }
    }

    return { success: true };
}

// Từ chối đơn nạp
async function dbAdminRejectRecharge(rechargeId) {
    var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
    localRecharges.forEach(function(r) {
        if (r.id === rechargeId) r.status = 'Đã từ chối';
    });
    localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));

    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('recharges').doc(rechargeId).update({
                status: 'Đã từ chối'
            }).catch(function(){});
        } catch(e) {
            console.warn("Firestore dbAdminRejectRecharge warn:", e);
        }
    }

    return { success: true };
}

// Cộng / Trừ Xu trực tiếp cho người dùng (Hợp nhất Local + Cloud)
async function dbAdminAdjustBalance(email, amountXu, note) {
    email = (email || '').trim().toLowerCase();
    var dateStr = new Date().toLocaleString('vi-VN');
    var adjId = 'ADJ-' + Date.now();
    var adjHistory = {
        id: adjId,
        type: 'admin_adjust',
        title: 'Admin điều chỉnh: ' + (note || 'Cộng/Trừ Xu'),
        amount: (amountXu >= 0 ? '+ ' : '') + amountXu + ' Xu',
        date: dateStr,
        status: 'Thành công'
    };

    var foundUser = null;

    // 1. Cập nhật Local Storage
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });

    if (matchedKey) {
        foundUser = localUsers[matchedKey];
        foundUser.balance = (foundUser.balance || 0) + amountXu;
        foundUser.history = foundUser.history || [];
        foundUser.history.unshift(adjHistory);
        localUsers[matchedKey] = foundUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
    }

    // 2. Cập nhật Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 2500);
            if (!userSnap.empty) {
                var uDoc = userSnap.docs[0];
                await uDoc.ref.update({
                    balance: firebase.firestore.FieldValue.increment(amountXu),
                    history: firebase.firestore.FieldValue.arrayUnion(adjHistory)
                });
                foundUser = uDoc.data();
            } else if (foundUser) {
                await firestoreDB.collection('users').doc(foundUser.uid).set(foundUser).catch(function(){});
            }
        } catch(e) {
            console.warn("Firestore dbAdminAdjustBalance warn:", e);
        }
    }

    // Nếu chưa tồn tại: Tự động khởi tạo user mới với số dư này
    if (!foundUser) {
        foundUser = {
            uid: 'usr_' + Date.now(),
            name: email.split('@')[0],
            email: email,
            balance: amountXu,
            code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
            packages: [],
            history: [adjHistory],
            createdAt: new Date().toISOString()
        };
        localUsers[email] = foundUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        if (isUsingCloudDB && firestoreDB) {
            firestoreDB.collection('users').doc(foundUser.uid).set(foundUser).catch(function(){});
        }
    }

    return { success: true, balance: foundUser.balance };
}

// Cấp gói Locket Gold trực tiếp cho khách hàng (Hợp nhất Local + Cloud)
async function dbAdminGrantPackage(email, pkgType, pkgName) {
    email = (email || '').trim().toLowerCase();
    var dateStr = new Date().toLocaleDateString('vi-VN');
    var orderDate = new Date().toLocaleString('vi-VN');
    var orderId = 'ADM-' + Math.floor(10000 + Math.random() * 90000);
    var newPkg = {
        id: 'PKG-' + Math.floor(10000 + Math.random() * 90000),
        type: pkgType,
        name: pkgName,
        date: dateStr,
        expires: 'Vĩnh viễn (2099)'
    };
    var newOrder = {
        id: orderId,
        userId: 'usr_' + Date.now(),
        userEmail: email,
        pkgType: pkgType,
        pkgName: pkgName + ' (Admin cấp)',
        priceXu: 0,
        date: orderDate,
        expires: 'Vĩnh viễn (2099)',
        status: 'Đã kích hoạt'
    };

    var foundUser = null;

    // 1. Kiểm tra và cập nhật Local Storage
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var localOrders = JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');

    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });

    if (matchedKey) {
        foundUser = localUsers[matchedKey];
        foundUser.packages = foundUser.packages || [];
        foundUser.packages.push(newPkg);
        foundUser.history = foundUser.history || [];
        foundUser.history.unshift({
            id: orderId,
            type: 'order',
            title: 'Được Admin cấp ' + pkgName,
            amount: '0 Xu (Miễn phí)',
            date: orderDate,
            status: 'Đã kích hoạt'
        });
        newOrder.userId = foundUser.uid || newOrder.userId;
        localUsers[matchedKey] = foundUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
    }

    localOrders.unshift(newOrder);
    localStorage.setItem('locket_gold_orders_db', JSON.stringify(localOrders));

    // 2. Đồng bộ lên Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 2500);
            if (!userSnap.empty) {
                var uDoc = userSnap.docs[0];
                newOrder.userId = uDoc.id;
                await uDoc.ref.update({
                    packages: firebase.firestore.FieldValue.arrayUnion(newPkg),
                    history: firebase.firestore.FieldValue.arrayUnion({
                        id: orderId,
                        type: 'order',
                        title: 'Được Admin cấp ' + pkgName,
                        amount: '0 Xu (Miễn phí)',
                        date: orderDate,
                        status: 'Đã kích hoạt'
                    })
                });
                foundUser = uDoc.data();
            } else if (foundUser) {
                // Tải user lên Firestore nếu chưa có
                await firestoreDB.collection('users').doc(foundUser.uid).set(foundUser).catch(function(){});
            }
            // Lưu order lên Firestore
            await firestoreDB.collection('orders').doc(orderId).set(newOrder).catch(function(){});
        } catch(e) {
            console.warn("Firestore dbAdminGrantPackage warn:", e);
        }
    }

    // Nếu không tìm thấy ở cả 2 nơi: Tự động khởi tạo user mới và cấp gói luôn!
    if (!foundUser) {
        foundUser = {
            uid: 'usr_' + Date.now(),
            name: email.split('@')[0],
            email: email,
            balance: 0,
            code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
            packages: [newPkg],
            history: [{
                id: orderId,
                type: 'order',
                title: 'Được Admin cấp ' + pkgName,
                amount: '0 Xu (Miễn phí)',
                date: orderDate,
                status: 'Đã kích hoạt'
            }],
            createdAt: new Date().toISOString()
        };
        localUsers[email] = foundUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        if (isUsingCloudDB && firestoreDB) {
            firestoreDB.collection('users').doc(foundUser.uid).set(foundUser).catch(function(){});
            firestoreDB.collection('orders').doc(orderId).set(newOrder).catch(function(){});
        }
    }

    return { success: true, user: foundUser };
}

async function dbAdminGetAllUsers() {
    var userMap = {};

    // 1. Luôn nạp toàn bộ khách hàng từ Local Storage trước (Siêu tốc & Chắc chắn không mất dữ liệu)
    try {
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        Object.values(localUsers).forEach(function(u) {
            if (u && u.email) {
                var k = u.email.toLowerCase();
                if (u.role === 'user' && k !== 'tranvannguyen991@gmail.com') {
                    u.role = 'user';
                } else if (u.role === 'admin' || checkIsAdmin(u)) {
                    u.role = 'admin';
                } else {
                    u.role = 'user';
                }
                userMap[k] = u;
            }
        });
    } catch(e) {
        console.warn("Local users read error:", e);
    }

    // 2. Hợp nhất thêm khách hàng từ Cloud Firestore nếu kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await runWithTimeout(firestoreDB.collection('users').get(), 2500);
            snapshot.forEach(function(doc) {
                var d = doc.data();
                if (d && d.email) {
                    var k = d.email.toLowerCase();
                    var merged = Object.assign(userMap[k] || {}, d);
                    if (merged.role === 'user' && k !== 'tranvannguyen991@gmail.com') {
                        merged.role = 'user';
                    } else if (merged.role === 'admin' || checkIsAdmin(merged)) {
                        merged.role = 'admin';
                    } else {
                        merged.role = 'user';
                    }
                    userMap[k] = merged;
                }
            });
        } catch(e) {
            console.warn("Firestore dbAdminGetAllUsers fallback:", e);
        }
    }

    return Object.values(userMap);
}

// Cấp hoặc hạ quyền Quản Trị Viên (Admin / User)
async function dbAdminToggleRole(email, newRole) {
    email = (email || '').trim().toLowerCase();
    newRole = newRole === 'admin' ? 'admin' : 'user';

    // 1. Cập nhật danh sách locket_custom_admin_emails
    try {
        var customAdmins = JSON.parse(localStorage.getItem('locket_custom_admin_emails') || '[]');
        if (newRole === 'admin') {
            if (!customAdmins.some(function(e) { return (e || '').toLowerCase() === email; })) {
                customAdmins.push(email);
            }
        } else {
            customAdmins = customAdmins.filter(function(e) { return (e || '').toLowerCase() !== email; });
        }
        localStorage.setItem('locket_custom_admin_emails', JSON.stringify(customAdmins));
    } catch(e) {}

    // 2. Cập nhật trong Local Storage users
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    if (matchedKey) {
        localUsers[matchedKey].role = newRole;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
    }

    // 3. Cập nhật appState nếu tài khoản này đang mở trên phiên hiện tại
    try {
        var appState = JSON.parse(localStorage.getItem('locket_gold_app_state') || '{}');
        if (appState && appState.user && (appState.user.email || '').toLowerCase() === email) {
            appState.user.role = newRole;
            localStorage.setItem('locket_gold_app_state', JSON.stringify(appState));
        }
    } catch(e) {}

    // 4. Cập nhật trên Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 3000);
            if (!userSnap.empty) {
                for (var i = 0; i < userSnap.docs.length; i++) {
                    await userSnap.docs[i].ref.update({ role: newRole }).catch(function(){});
                }
            } else {
                var allSnap = await runWithTimeout(firestoreDB.collection('users').get(), 3000);
                for (var j = 0; j < allSnap.docs.length; j++) {
                    var doc = allSnap.docs[j];
                    var data = doc.data();
                    if (data && (data.email || '').toLowerCase() === email) {
                        await doc.ref.update({ role: newRole }).catch(function(){});
                    }
                }
            }
        } catch(e) {
            console.warn("Firestore dbAdminToggleRole warn:", e);
        }
    }

    return { success: true, role: newRole };
}

// Xóa tài khoản khách hàng (Hợp nhất Local Storage & Cloud Firestore)
async function dbAdminDeleteUser(email) {
    email = (email || '').trim().toLowerCase();
    if (!email) return { success: false, error: 'Thiếu email tài khoản cần xóa!' };

    // Bảo vệ tuyệt đối tài khoản Quản Trị Viên Tối Cao
    if (email === 'tranvannguyen991@gmail.com') {
        return { success: false, error: 'Không thể xóa tài khoản Quản Trị Viên Gốc!' };
    }

    // 1. Cập nhật Local Storage
    try {
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        var matchedKey = Object.keys(localUsers).find(function(k) { return k.toLowerCase() === email; });
        if (matchedKey) {
            delete localUsers[matchedKey];
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        }

        var customAdmins = JSON.parse(localStorage.getItem('locket_custom_admin_emails') || '[]');
        customAdmins = customAdmins.filter(function(e) { return (e || '').toLowerCase() !== email; });
        localStorage.setItem('locket_custom_admin_emails', JSON.stringify(customAdmins));
    } catch(e) {
        console.warn("Delete local user warn:", e);
    }

    // 2. Cập nhật Cloud Firestore nếu có kết nối
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 3000);
            if (!userSnap.empty) {
                for (var i = 0; i < userSnap.docs.length; i++) {
                    await userSnap.docs[i].ref.delete().catch(function(){});
                }
            } else {
                var allSnap = await runWithTimeout(firestoreDB.collection('users').get(), 3000);
                for (var j = 0; j < allSnap.docs.length; j++) {
                    var doc = allSnap.docs[j];
                    var d = doc.data();
                    if (d && (d.email || '').trim().toLowerCase() === email) {
                        await doc.ref.delete().catch(function(){});
                    }
                }
            }
        } catch(e) {
            console.warn("Delete firestore user warn:", e);
        }
    }

    return { success: true };
}

// Lưu cấu hình Firebase tùy chỉnh người dùng nhập vào
function saveCustomFirebaseConfig(config) {
    try {
        localStorage.setItem('custom_firebase_config', JSON.stringify(config));
        location.reload();
        return true;
    } catch(e) {
        return false;
    }
}

// Tự động nạp custom config nếu có
(function checkCustomConfig() {
    var saved = localStorage.getItem('custom_firebase_config');
    if (saved) {
        try {
            var parsed = JSON.parse(saved);
            if (parsed.apiKey && parsed.projectId) {
                firebaseConfig = parsed;
            }
        } catch(e) {}
    }
})();

// =========================================================================
// QUẢN LÝ VOUCHER / MÃ GIẢM GIÁ (VOUCHER ENGINE)
// =========================================================================

// Khởi tạo các mã Voucher mặc định ban đầu nếu chưa có
var DEFAULT_VOUCHERS = [
    {
        code: 'LOCKET5',
        type: 'fixed',
        value: 5,
        maxUses: 100,
        usedCount: 0,
        description: 'Giảm ngay 5 Xu cho mọi đơn mua gói',
        active: true,
        isActive: true,
        createdAt: '2026-11-12T00:00:00.000Z'
    },
    {
        code: 'TRIAN20',
        type: 'percent',
        value: 20,
        maxUses: 50,
        usedCount: 0,
        description: 'Giảm 20% tổng tiền gói Locket Gold',
        active: true,
        isActive: true,
        createdAt: '2026-11-12T00:00:00.000Z'
    },
    {
        code: 'DEN2026',
        type: 'fixed',
        value: 10,
        maxUses: 30,
        usedCount: 0,
        description: 'Voucher đặc quyền giảm 10 Xu từ Văn Nguyên',
        active: true,
        isActive: true,
        createdAt: '2026-11-12T00:00:00.000Z'
    }
];

// Lấy toàn bộ danh sách Voucher (Hợp nhất Local + Cloud)
async function dbGetAllVouchers() {
    var vouchersMap = {};

    // 1. Nạp từ Local Storage
    try {
        var localVouchers = JSON.parse(localStorage.getItem('locket_gold_vouchers_db') || 'null');
        if (!localVouchers || !Array.isArray(localVouchers) || localVouchers.length === 0) {
            localVouchers = DEFAULT_VOUCHERS;
            localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(localVouchers));
        }
        localVouchers.forEach(function(v) {
            if (v && v.code) vouchersMap[v.code.toUpperCase()] = v;
        });
    } catch(e) {}

    // 2. Nạp thêm từ Cloud Firestore nếu có
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snap = await runWithTimeout(firestoreDB.collection('vouchers').get(), 3000);
            if (!snap.empty) {
                snap.forEach(function(doc) {
                    var d = doc.data();
                    if (d && d.code) {
                        var c = d.code.toUpperCase();
                        vouchersMap[c] = Object.assign({}, vouchersMap[c] || {}, d);
                    }
                });
            } else {
                // Tải mẫu lên Firestore nếu rỗng
                DEFAULT_VOUCHERS.forEach(function(v) {
                    firestoreDB.collection('vouchers').doc(v.code).set(v).catch(function(){});
                });
            }
        } catch(e) {
            console.warn("Firestore get vouchers warn:", e);
        }
    }

    var list = Object.values(vouchersMap).map(function(v) {
        var act = (v.active !== undefined) ? v.active : (v.isActive !== undefined ? v.isActive : true);
        v.active = act;
        v.isActive = act;
        return v;
    });
    try {
        localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(list));
    } catch(e) {}
    return list;
}

// Tạo mới Voucher
async function dbAdminCreateVoucher(voucherData) {
    if (!voucherData || !voucherData.code) {
        return { success: false, error: 'Thiếu mã voucher!' };
    }
    var code = voucherData.code.trim().toUpperCase();
    var act = voucherData.active !== false && voucherData.isActive !== false;
    var newVoucher = {
        code: code,
        type: voucherData.type === 'percent' ? 'percent' : 'fixed',
        value: Number(voucherData.value) || 0,
        maxUses: Number(voucherData.maxUses) || 0,
        usedCount: Number(voucherData.usedCount) || 0,
        description: voucherData.description || ('Mã giảm giá ' + code),
        active: act,
        isActive: act,
        createdAt: new Date().toISOString()
    };

    // 1. Lưu Local Storage
    try {
        var list = JSON.parse(localStorage.getItem('locket_gold_vouchers_db') || '[]');
        list = list.filter(function(v) { return (v.code || '').toUpperCase() !== code; });
        list.unshift(newVoucher);
        localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(list));
    } catch(e) {}

    // 2. Lưu Cloud Firestore
    if (isUsingCloudDB && firestoreDB) {
        try {
            await runWithTimeout(firestoreDB.collection('vouchers').doc(code).set(newVoucher), 3000);
        } catch(e) {
            console.warn("Firestore create voucher warn:", e);
        }
    }

    return { success: true, voucher: newVoucher };
}

// Xóa Voucher
async function dbAdminDeleteVoucher(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Thiếu mã voucher cần xóa!' };

    // 1. Xóa trong Local
    try {
        var list = JSON.parse(localStorage.getItem('locket_gold_vouchers_db') || '[]');
        list = list.filter(function(v) { return (v.code || '').toUpperCase() !== code; });
        localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(list));
    } catch(e) {}

    // 2. Xóa trên Cloud Firestore
    if (isUsingCloudDB && firestoreDB) {
        try {
            await runWithTimeout(firestoreDB.collection('vouchers').doc(code).delete(), 3000);
        } catch(e) {
            console.warn("Firestore delete voucher warn:", e);
        }
    }

    return { success: true };
}

// Bật / Tắt trạng thái Voucher
async function dbAdminToggleVoucher(code) {
    code = (code || '').trim().toUpperCase();
    var updatedStatus = false;

    // 1. Local
    try {
        var list = JSON.parse(localStorage.getItem('locket_gold_vouchers_db') || '[]');
        var found = false;
        list.forEach(function(v) {
            if ((v.code || '').toUpperCase() === code) {
                var curr = (v.active !== undefined) ? v.active : (v.isActive !== undefined ? v.isActive : true);
                v.active = !curr;
                v.isActive = v.active;
                updatedStatus = v.active;
                found = true;
            }
        });
        if (found) {
            localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(list));
        }
    } catch(e) {}

    // 2. Cloud Firestore
    if (isUsingCloudDB && firestoreDB) {
        try {
            var docRef = firestoreDB.collection('vouchers').doc(code);
            var snap = await runWithTimeout(docRef.get(), 2500).catch(function(){ return null; });
            if (snap && snap.exists) {
                var d = snap.data();
                var currCloud = (d.active !== undefined) ? d.active : (d.isActive !== undefined ? d.isActive : true);
                updatedStatus = !currCloud;
                await runWithTimeout(docRef.update({ active: updatedStatus, isActive: updatedStatus }), 2500).catch(function(){});
            } else {
                await runWithTimeout(docRef.set({ code: code, active: updatedStatus, isActive: updatedStatus }, { merge: true }), 2500).catch(function(){});
            }
        } catch(e) {
            console.warn("Firestore toggle voucher error:", e);
        }
    }

    return { success: true, active: updatedStatus, isActive: updatedStatus };
}

// Áp dụng và Kiểm tra Voucher cho đơn hàng
async function dbApplyVoucher(code, originalPriceXu) {
    code = (code || '').trim().toUpperCase();
    originalPriceXu = Number(originalPriceXu) || 0;

    if (!code) {
        return { valid: false, error: 'Vui lòng nhập mã voucher!' };
    }

    var vouchers = await dbGetAllVouchers();
    var voucher = vouchers.find(function(v) {
        return (v.code || '').toUpperCase() === code;
    });

    if (!voucher) {
        return { valid: false, error: 'Mã voucher "' + code + '" không tồn tại hoặc đã bị xóa!' };
    }

    if (!voucher.active) {
        return { valid: false, error: 'Mã voucher "' + code + '" hiện đang tạm ngưng sử dụng!' };
    }

    if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
        return { valid: false, error: 'Mã voucher "' + code + '" đã hết lượt sử dụng (Tối đa ' + voucher.maxUses + ' lượt)!' };
    }

    var discountXu = 0;
    if (voucher.type === 'percent') {
        discountXu = Math.round(originalPriceXu * (voucher.value / 100));
    } else {
        discountXu = Number(voucher.value) || 0;
    }

    // Đảm bảo không giảm quá giá trị đơn hàng, tối thiểu thanh toán 1 Xu
    discountXu = Math.min(discountXu, Math.max(0, originalPriceXu - 1));
    var finalPriceXu = Math.max(1, originalPriceXu - discountXu);

    return {
        valid: true,
        code: code,
        voucher: voucher,
        discountXu: discountXu,
        finalPriceXu: finalPriceXu,
        message: 'Áp dụng thành công mã ' + code + ': Giảm -' + discountXu + ' Xu!'
    };
}

// Ghi nhận đã dùng voucher +1 lượt
async function dbRecordVoucherUse(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) return;

    try {
        var list = JSON.parse(localStorage.getItem('locket_gold_vouchers_db') || '[]');
        list.forEach(function(v) {
            if ((v.code || '').toUpperCase() === code) {
                v.usedCount = (v.usedCount || 0) + 1;
            }
        });
        localStorage.setItem('locket_gold_vouchers_db', JSON.stringify(list));
    } catch(e) {}

    if (isUsingCloudDB && firestoreDB) {
        try {
            firestoreDB.collection('vouchers').doc(code).update({
                usedCount: firebase.firestore.FieldValue.increment(1)
            }).catch(function(){});
        } catch(e) {}
    }
}


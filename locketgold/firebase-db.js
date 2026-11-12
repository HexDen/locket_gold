/**
 * Locket Gold VIP - Firebase Cloud Firestore & Auth Integration Module
 * Hỗ trợ lưu trữ CSDL thời gian thực: Tài khoản, Số dư Xu, Lịch sử nạp và Đơn mua gói.
 * Có cơ chế tự động Fallback sang LocalStorage nếu chưa cấu hình Firebase.
 */

// CẤU HÌNH FIREBASE CỦA BẠN
// Lấy thông tin này tại: https://console.firebase.google.com -> Project Settings -> General -> Your apps
var firebaseConfig = {
    apiKey: "AIzaSyYOUR_API_KEY_HERE",
    authDomain: "locket-gold-vip.firebaseapp.com",
    projectId: "locket-gold-vip",
    storageBucket: "locket-gold-vip.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
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

// Danh sách Email mặc định có đặc quyền Quản Trị Viên (Admin)
var DEFAULT_ADMIN_EMAILS = [
    'tranvannguyen991@gmail.com',
    'tranvannguyen992z@gmail.com',
    'admin@locketgold.com',
    'admin@gmail.com'
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
    if (role === 'admin') return true;
    if (DEFAULT_ADMIN_EMAILS.some(function(adm) { return adm.toLowerCase() === email; })) {
        return true;
    }
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

// Đăng nhập tài khoản
async function dbLoginUser(email, password) {
    email = (email || '').trim().toLowerCase();

    // 1. Kiểm tra Local Storage trước tiên (Siêu tốc 0.001s)
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var matchedKey = Object.keys(localUsers).find(function(k) {
        return k.toLowerCase() === email;
    });
    var localUser = matchedKey ? localUsers[matchedKey] : null;

    if (localUser && localUser.password && localUser.password === password) {
        if (checkIsAdmin(localUser) || checkIsAdmin(email)) {
            localUser.role = 'admin';
        } else {
            localUser.role = localUser.role || 'user';
        }
        localUsers[matchedKey] = localUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { success: true, user: localUser };
    }

    // 2. Thử Firebase Cloud Auth nếu đã cấu hình (có giới hạn timeout 2.5s)
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCredential = await runWithTimeout(firebaseAuth.signInWithEmailAndPassword(email, password), 2500);
            var uid = userCredential.user.uid;
            var isAdminRole = checkIsAdmin(email);
            
            var defaultData = {
                uid: uid,
                name: userCredential.user.displayName || email.split('@')[0],
                email: email,
                role: isAdminRole ? 'admin' : 'user',
                balance: 0,
                code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
                packages: [],
                history: [],
                createdAt: new Date().toISOString()
            };

            // Lưu local cache
            localUsers[email] = defaultData;
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

            // Thử lấy dữ liệu Firestore không block
            if (firestoreDB) {
                firestoreDB.collection('users').doc(uid).get().then(function(doc) {
                    if (doc.exists) {
                        var cloudData = doc.data();
                        if (checkIsAdmin(cloudData) || checkIsAdmin(email)) {
                            cloudData.role = 'admin';
                        } else {
                            cloudData.role = cloudData.role || 'user';
                        }
                        localUsers[email] = cloudData;
                        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                    } else {
                        firestoreDB.collection('users').doc(uid).set(defaultData).catch(function(){});
                    }
                }).catch(function(){});
            }

            return { success: true, user: defaultData };
        } catch (err) {
            console.warn("Firebase Auth signIn catch:", err.code || err.message);

            if (err.message === 'TIMEOUT' || err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed' || err.code === 'auth/network-request-failed') {
                if (localUser) {
                    if (localUser.password && localUser.password !== password) {
                        return { success: false, error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.' };
                    }
                    if (checkIsAdmin(localUser) || checkIsAdmin(email)) {
                        localUser.role = 'admin';
                    } else {
                        localUser.role = localUser.role || 'user';
                    }
                    localUsers[matchedKey] = localUser;
                    localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                    return { success: true, user: localUser };
                }
                return { success: false, error: 'Tài khoản chưa tồn tại hoặc sai mật khẩu. Vui lòng bấm Đăng ký tài khoản mới!' };
            }

            var errMsg = 'Đăng nhập không thành công.';
            if (err.code === 'auth/user-not-found') {
                errMsg = 'Tài khoản chưa tồn tại. Vui lòng bấm Đăng ký tài khoản mới!';
            } else if (err.code === 'auth/wrong-password') {
                errMsg = 'Mật khẩu không chính xác! Vui lòng thử lại hoặc bấm Quên mật khẩu.';
            } else if (err.code === 'auth/invalid-email') {
                errMsg = 'Địa chỉ email không đúng định dạng.';
            } else if (err.code === 'auth/too-many-requests') {
                errMsg = 'Đã thử sai quá nhiều lần. Vui lòng đợi vài phút hoặc bấm Quên mật khẩu!';
            } else {
                errMsg = err.message || errMsg;
            }
            return { success: false, error: errMsg };
        }
    }

    if (localUser) {
        if (localUser.password && localUser.password !== password) {
            return { success: false, error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.' };
        }
        if (checkIsAdmin(localUser) || checkIsAdmin(email)) {
            localUser.role = 'admin';
        } else {
            localUser.role = localUser.role || 'user';
        }
        localUsers[matchedKey] = localUser;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { success: true, user: localUser };
    }

    return { success: false, error: 'Tài khoản chưa tồn tại trên hệ thống! Vui lòng bấm tab Đăng Ký để tạo tài khoản mới.' };
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

// Khôi phục / Quên mật khẩu (Siêu tốc)
async function dbResetPassword(email) {
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');

    if (isUsingCloudDB && firebaseAuth) {
        try {
            await runWithTimeout(firebaseAuth.sendPasswordResetEmail(email), 2500);
            return { 
                success: true, 
                message: 'Đã gửi email khôi phục mật khẩu tới ' + email + '. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam) để đặt lại mật khẩu mới!' 
            };
        } catch (err) {
            console.warn("Firebase Auth reset catch:", err.code || err.message);
            // Fallback reset về 123456
            if (localUsers[email]) {
                localUsers[email].password = '123456';
                localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                return {
                    success: true,
                    message: 'Khôi phục thành công! Mật khẩu của tài khoản ' + email + ' đã được đặt lại là: 123456. Bạn có thể đăng nhập ngay!'
                };
            }
            if (err.code === 'auth/user-not-found') {
                return { success: false, error: 'Không tìm thấy tài khoản nào với địa chỉ email này!' };
            }
            return { success: false, error: 'Không tìm thấy tài khoản với email này trên hệ thống.' };
        }
    }

    if (localUsers[email]) {
        localUsers[email].password = '123456';
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { 
            success: true, 
            message: 'Khôi phục thành công! Mật khẩu của tài khoản ' + email + ' đã được đặt lại là: 123456. Bạn có thể dùng mật khẩu này để đăng nhập ngay.' 
        };
    }

    return { success: false, error: 'Không tìm thấy tài khoản nào với email: ' + email };
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
                if (checkIsAdmin(u) || checkIsAdmin(k)) {
                    u.role = 'admin';
                } else {
                    u.role = u.role || 'user';
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
                    if (checkIsAdmin(merged) || checkIsAdmin(k)) {
                        merged.role = 'admin';
                    } else {
                        merged.role = merged.role || 'user';
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
            var userSnap = await runWithTimeout(firestoreDB.collection('users').where('email', '==', email).get(), 2500);
            if (!userSnap.empty) {
                await userSnap.docs[0].ref.update({ role: newRole });
            }
        } catch(e) {
            console.warn("Firestore dbAdminToggleRole warn:", e);
        }
    }

    return { success: true, role: newRole };
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


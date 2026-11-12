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
    // 1. Kiểm tra Local Storage trước tiên (Siêu tốc 0.001s)
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var localUser = localUsers[email];
    if (localUser && localUser.password && localUser.password === password) {
        return { success: true, user: localUser };
    }

    // 2. Thử Firebase Cloud Auth nếu đã cấu hình (có giới hạn timeout 2.5s)
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCredential = await runWithTimeout(firebaseAuth.signInWithEmailAndPassword(email, password), 2500);
            var uid = userCredential.user.uid;
            
            var defaultData = {
                uid: uid,
                name: userCredential.user.displayName || email.split('@')[0],
                email: email,
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
        return { success: true, user: localUser };
    }

    return { success: false, error: 'Tài khoản chưa tồn tại trên hệ thống! Vui lòng bấm tab Đăng Ký để tạo tài khoản mới.' };
}

// Đăng ký tài khoản mới (Siêu tốc & Chống treo tuyệt đối)
async function dbRegisterUser(name, email, password) {
    // 1. Kiểm tra tồn tại trong Local Storage (0.001s)
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    if (localUsers[email]) {
        return { success: false, error: 'Email này đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập.' };
    }

    var uid = 'usr_' + Date.now();
    var newUserData = {
        uid: uid,
        name: name || email.split('@')[0],
        email: email,
        password: password,
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

async function dbCreateRecharge(rechargeData) {
    // rechargeData: { id, userId, userEmail, xu, amountVnd, date, status }
    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('recharges').doc(rechargeData.id).set(rechargeData);
            // Ghi vào mảng history của user
            var userRef = firestoreDB.collection('users').doc(rechargeData.userId);
            await userRef.update({
                balance: firebase.firestore.FieldValue.increment(rechargeData.xu),
                history: firebase.firestore.FieldValue.arrayUnion({
                    id: rechargeData.id,
                    type: 'recharge',
                    title: 'Nạp Xu VietQR (MB Bank)',
                    amount: '+ ' + rechargeData.xu + ' Xu (' + rechargeData.amountVnd.toLocaleString('vi-VN') + ' đ)',
                    date: rechargeData.date,
                    status: 'Thành công'
                })
            });
            return { success: true };
        } catch (err) {
            console.error("Lỗi ghi recharge Firestore:", err);
            return { success: false, error: err.message };
        }
    } else {
        // Local DB
        var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        localRecharges.unshift(rechargeData);
        localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));
        return { success: true };
    }
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


// Lấy toàn bộ đơn nạp tiền
async function dbAdminGetAllRecharges() {
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await firestoreDB.collection('recharges').get();
            var list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list.reverse();
        } catch(e) {
            console.error("Firestore dbAdminGetAllRecharges error:", e);
            return JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        }
    } else {
        return JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
    }
}

// Lấy toàn bộ đơn mua gói
async function dbAdminGetAllOrders() {
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await firestoreDB.collection('orders').get();
            var list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list.reverse();
        } catch(e) {
            console.error("Firestore dbAdminGetAllOrders error:", e);
            return JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');
        }
    } else {
        return JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');
    }
}

// Duyệt nạp tiền (Cộng Xu cho khách)
async function dbAdminApproveRecharge(rechargeId, userEmail, xu) {
    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('recharges').doc(rechargeId).update({
                status: 'Thành công'
            });
            var userSnap = await firestoreDB.collection('users').where('email', '==', userEmail).get();
            if (!userSnap.empty) {
                var uDoc = userSnap.docs[0];
                await uDoc.ref.update({
                    balance: firebase.firestore.FieldValue.increment(xu)
                });
            }
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    } else {
        var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        localRecharges.forEach(function(r) {
            if (r.id === rechargeId) r.status = 'Thành công';
        });
        localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));

        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        if (localUsers[userEmail]) {
            localUsers[userEmail].balance = (localUsers[userEmail].balance || 0) + xu;
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        }
        return { success: true };
    }
}

// Từ chối đơn nạp
async function dbAdminRejectRecharge(rechargeId) {
    if (isUsingCloudDB && firestoreDB) {
        try {
            await firestoreDB.collection('recharges').doc(rechargeId).update({
                status: 'Đã từ chối'
            });
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    } else {
        var localRecharges = JSON.parse(localStorage.getItem('locket_gold_recharges_db') || '[]');
        localRecharges.forEach(function(r) {
            if (r.id === rechargeId) r.status = 'Đã từ chối';
        });
        localStorage.setItem('locket_gold_recharges_db', JSON.stringify(localRecharges));
        return { success: true };
    }
}

// Cộng / Trừ Xu trực tiếp cho người dùng
async function dbAdminAdjustBalance(email, amountXu, note) {
    var dateStr = new Date().toLocaleString('vi-VN');
    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await firestoreDB.collection('users').where('email', '==', email).get();
            if (userSnap.empty) {
                return { success: false, error: 'Không tìm thấy tài khoản với email này!' };
            }
            var uDoc = userSnap.docs[0];
            await uDoc.ref.update({
                balance: firebase.firestore.FieldValue.increment(amountXu),
                history: firebase.firestore.FieldValue.arrayUnion({
                    id: 'ADJ-' + Date.now(),
                    type: 'admin_adjust',
                    title: 'Admin điều chỉnh: ' + (note || 'Cộng/Trừ Xu'),
                    amount: (amountXu >= 0 ? '+ ' : '') + amountXu + ' Xu',
                    date: dateStr,
                    status: 'Thành công'
                })
            });
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    } else {
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        if (!localUsers[email]) {
            return { success: false, error: 'Không tìm thấy tài khoản!' };
        }
        localUsers[email].balance = (localUsers[email].balance || 0) + amountXu;
        localUsers[email].history = localUsers[email].history || [];
        localUsers[email].history.unshift({
            id: 'ADJ-' + Date.now(),
            type: 'admin_adjust',
            title: 'Admin điều chỉnh: ' + (note || 'Cộng/Trừ Xu'),
            amount: (amountXu >= 0 ? '+ ' : '') + amountXu + ' Xu',
            date: dateStr,
            status: 'Thành công'
        });
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { success: true };
    }
}

// Cấp gói Locket Gold trực tiếp cho khách hàng
async function dbAdminGrantPackage(email, pkgType, pkgName) {
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

    if (isUsingCloudDB && firestoreDB) {
        try {
            var userSnap = await firestoreDB.collection('users').where('email', '==', email).get();
            if (userSnap.empty) {
                return { success: false, error: 'Không tìm thấy tài khoản khách hàng!' };
            }
            var uDoc = userSnap.docs[0];
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
            await firestoreDB.collection('orders').doc(orderId).set({
                id: orderId,
                userId: uDoc.id,
                userEmail: email,
                pkgType: pkgType,
                pkgName: pkgName + ' (Admin cấp)',
                priceXu: 0,
                date: orderDate,
                expires: 'Vĩnh viễn (2099)',
                status: 'Đã kích hoạt'
            });
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    } else {
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        if (!localUsers[email]) {
            return { success: false, error: 'Không tìm thấy tài khoản!' };
        }
        localUsers[email].packages = localUsers[email].packages || [];
        localUsers[email].packages.push(newPkg);
        localUsers[email].history = localUsers[email].history || [];
        localUsers[email].history.unshift({
            id: orderId,
            type: 'order',
            title: 'Được Admin cấp ' + pkgName,
            amount: '0 Xu (Miễn phí)',
            date: orderDate,
            status: 'Đã kích hoạt'
        });
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));

        var localOrders = JSON.parse(localStorage.getItem('locket_gold_orders_db') || '[]');
        localOrders.unshift({
            id: orderId,
            userId: localUsers[email].uid,
            userEmail: email,
            pkgType: pkgType,
            pkgName: pkgName + ' (Admin cấp)',
            priceXu: 0,
            date: orderDate,
            expires: 'Vĩnh viễn (2099)',
            status: 'Đã kích hoạt'
        });
        localStorage.setItem('locket_gold_orders_db', JSON.stringify(localOrders));
        return { success: true };
    }
}

async function dbAdminGetAllUsers() {
    if (isUsingCloudDB && firestoreDB) {
        try {
            var snapshot = await firestoreDB.collection('users').get();
            var list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list;
        } catch(e) {
            return [];
        }
    } else {
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        return Object.values(localUsers);
    }
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


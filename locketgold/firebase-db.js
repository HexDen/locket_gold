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

// Đăng nhập tài khoản
async function dbLoginUser(email, password) {
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            var uid = userCredential.user.uid;
            var userDoc = await firestoreDB.collection('users').doc(uid).get();
            if (userDoc.exists) {
                return { success: true, user: userDoc.data() };
            } else {
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
                await firestoreDB.collection('users').doc(uid).set(defaultData);
                return { success: true, user: defaultData };
            }
        } catch (err) {
            console.warn("Firebase Auth signIn catch:", err.code, err.message);
            // Nếu Firebase Auth chưa bật Email/Password (auth/configuration-not-found / auth/operation-not-allowed)
            if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
                if (firestoreDB) {
                    try {
                        var snap = await firestoreDB.collection('users').where('email', '==', email).get();
                        if (!snap.empty) {
                            var uDoc = snap.docs[0];
                            var uData = uDoc.data();
                            if (uData.password && uData.password !== password) {
                                return { success: false, error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.' };
                            }
                            return { success: true, user: uData };
                        }
                    } catch(fsErr) {
                        console.warn("Firestore query fallback error:", fsErr);
                    }
                }
                // Fallback to local
                return dbLoginUserLocal(email, password);
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
    } else {
        return dbLoginUserLocal(email, password);
    }
}

// Hàm hỗ trợ đăng nhập Local Storage
function dbLoginUserLocal(email, password) {
    var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
    var user = localUsers[email];
    if (!user) {
        return { success: false, error: 'Tài khoản chưa tồn tại! Vui lòng bấm tab Đăng Ký để tạo tài khoản mới.' };
    }
    if (user.password && user.password !== password) {
        return { success: false, error: 'Mật khẩu không chính xác! Vui lòng thử lại hoặc bấm Quên mật khẩu.' };
    }
    return { success: true, user: user };
}

// Đăng ký tài khoản mới
async function dbRegisterUser(name, email, password) {
    if (isUsingCloudDB && firebaseAuth) {
        try {
            var userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            var uid = userCredential.user.uid;
            if (userCredential.user && userCredential.user.updateProfile) {
                await userCredential.user.updateProfile({ displayName: name });
            }
            var newUserData = {
                uid: uid,
                name: name || email.split('@')[0],
                email: email,
                balance: 0,
                code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
                packages: [],
                history: [],
                createdAt: new Date().toISOString()
            };
            await firestoreDB.collection('users').doc(uid).set(newUserData);
            return { success: true, user: newUserData };
        } catch (err) {
            console.warn("Firebase Auth createUser catch:", err.code, err.message);
            // TỰ ĐỘNG BẢO VỆ: Nếu Firebase Auth chưa cấu hình Email/Password (auth/configuration-not-found / auth/operation-not-allowed)
            if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
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
                if (firestoreDB) {
                    try {
                        var snap = await firestoreDB.collection('users').where('email', '==', email).get();
                        if (!snap.empty) {
                            return { success: false, error: 'Email này đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập.' };
                        }
                        await firestoreDB.collection('users').doc(uid).set(newUserData);
                    } catch(fsErr) {
                        console.warn("Direct firestore write error:", fsErr);
                    }
                }
                var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
                localUsers[email] = newUserData;
                localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                return { success: true, user: newUserData };
            }

            var errMsg = err.message;
            if (err.code === 'auth/email-already-in-use') {
                errMsg = 'Email này đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập hoặc Quên mật khẩu.';
            } else if (err.code === 'auth/weak-password') {
                errMsg = 'Mật khẩu quá ngắn! Mật khẩu phải có ít nhất 6 ký tự.';
            } else if (err.code === 'auth/invalid-email') {
                errMsg = 'Địa chỉ email không đúng định dạng!';
            }
            return { success: false, error: errMsg };
        }
    } else {
        // Local DB Fallback
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        if (localUsers[email]) {
            return { success: false, error: 'Email này đã được đăng ký trên hệ thống! Vui lòng chọn Đăng nhập.' };
        }
        var newUserData = {
            uid: 'usr_' + Date.now(),
            name: name || email.split('@')[0],
            email: email,
            password: password,
            balance: 0,
            code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
            packages: [],
            history: [],
            createdAt: new Date().toISOString()
        };
        localUsers[email] = newUserData;
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { success: true, user: newUserData };
    }
}

// Khôi phục / Quên mật khẩu
async function dbResetPassword(email) {
    if (isUsingCloudDB && firebaseAuth) {
        try {
            await firebaseAuth.sendPasswordResetEmail(email);
            return { 
                success: true, 
                message: 'Đã gửi email khôi phục mật khẩu tới ' + email + '. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam) để đặt lại mật khẩu mới!' 
            };
        } catch (err) {
            console.warn("Firebase Auth reset catch:", err.code, err.message);
            if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
                // Fallback reset password to 123456
                var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
                if (localUsers[email]) {
                    localUsers[email].password = '123456';
                    localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
                }
                if (firestoreDB) {
                    try {
                        var snap = await firestoreDB.collection('users').where('email', '==', email).get();
                        if (!snap.empty) {
                            await snap.docs[0].ref.update({ password: '123456' });
                        }
                    } catch(e) {}
                }
                return {
                    success: true,
                    message: 'Khôi phục thành công! Mật khẩu của tài khoản ' + email + ' đã được đặt lại là: 123456. Bạn có thể đăng nhập ngay!'
                };
            }

            var errMsg = 'Không thể gửi email khôi phục.';
            if (err.code === 'auth/user-not-found') {
                errMsg = 'Không tìm thấy tài khoản nào với địa chỉ email này!';
            } else if (err.code === 'auth/invalid-email') {
                errMsg = 'Địa chỉ email không hợp lệ!';
            } else {
                errMsg = err.message || errMsg;
            }
            return { success: false, error: errMsg };
        }
    } else {
        // Local DB Fallback Engine
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        if (!localUsers[email]) {
            return { success: false, error: 'Không tìm thấy tài khoản nào với email: ' + email };
        }
        localUsers[email].password = '123456';
        localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        return { 
            success: true, 
            message: 'Khôi phục thành công! Mật khẩu của tài khoản ' + email + ' đã được đặt lại là: 123456. Bạn có thể dùng mật khẩu này để đăng nhập ngay.' 
        };
    }
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


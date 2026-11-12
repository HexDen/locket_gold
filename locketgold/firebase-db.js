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
// 1. TÀI KHOẢN & ĐĂNG NHẬP / ĐĂNG KÝ (USERS)
// =========================================================================

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
            // Nếu tài khoản chưa tồn tại thì tự động tạo mới luôn
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                try {
                    var newCred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
                    var newUid = newCred.user.uid;
                    var newUserData = {
                        uid: newUid,
                        email: email,
                        balance: 0,
                        code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
                        packages: [],
                        history: [],
                        createdAt: new Date().toISOString()
                    };
                    await firestoreDB.collection('users').doc(newUid).set(newUserData);
                    return { success: true, user: newUserData };
                } catch (createErr) {
                    return { success: false, error: createErr.message };
                }
            }
            return { success: false, error: err.message };
        }
    } else {
        // Local DB Fallback
        var localUsers = JSON.parse(localStorage.getItem('locket_gold_users_db') || '{}');
        var user = localUsers[email];
        if (!user) {
            user = {
                uid: 'usr_' + Date.now(),
                email: email,
                balance: 0,
                code: 'gTSx' + Math.floor(1000 + Math.random() * 9000),
                packages: [],
                history: [],
                createdAt: new Date().toISOString()
            };
            localUsers[email] = user;
            localStorage.setItem('locket_gold_users_db', JSON.stringify(localUsers));
        }
        return { success: true, user: user };
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

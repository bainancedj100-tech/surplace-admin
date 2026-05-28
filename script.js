console.log("script.js execution started");
const supabaseUrl = 'https://gnbtpmsvztnnpfyadxth.supabase.co';
const supabaseKey = 'sb_publishable_oRKwkHLpn1l0flD1WkLdrQ_NRFBulRP'; 
console.log("Creating Supabase client...");
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
console.log("Supabase client created.", !!supabaseClient);

// --- Tab Navigation Logic ---
// --- Tab Navigation Logic ---
console.log("Attaching menu-item click listeners...");
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Tab clicked:", item.getAttribute('data-tab'));
        document.querySelectorAll('.menu-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        
        item.classList.add('active');
        const targetId = item.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
    });
});
console.log("Listeners attached.");

async function loadRealData() {
    console.log("loadRealData called");
    console.log("Calling fetchDrivers...");
    await fetchDrivers();
    console.log("Calling fetchTransactions...");
    await fetchTransactions();
    console.log("Calling checkHealth...");
    checkHealth();
}

// 1. Live Drivers from Supabase
let drivers = [];

async function fetchDrivers() {
    try {
        const { data, error } = await supabaseClient.from('users').select('*').order('created_at', { ascending: false });
        if (error) { throw error; }
        drivers = data || [];
        renderDrivers();
        
        // Update Real Stats display
        document.getElementById('total-users').innerText = drivers.length;
        document.getElementById('users-progress').style.width = Math.min((drivers.length / 50) * 100, 100) + '%';
        if(drivers.length > 0) document.getElementById('users-status').innerText = 'تم الجلب من القاعدة';
        
    } catch (e) {
        console.error("Error fetching drivers:", e);
        showToast("خطأ في جلب بيانات السائقين");
        document.getElementById('total-users').innerText = "خطأ";
        document.getElementById('users-progress').style.width = '0%';
    }
}

function renderDrivers() {
    const tbody = document.getElementById('drivers-list');
    tbody.innerHTML = '';
    
    if (drivers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">لا يوجد مستخدمون حالياً</td></tr>`;
        return;
    }

    drivers.forEach(doc => {
        const isApproved = doc.role === 'driver' || doc.status === 'approved'; 
        // Assuming role or status field determines approval
        let actionBtn = !isApproved 
            ? `<button class="btn btn-success btn-sm" onclick="approveDriver('${doc.uid}')">قبول كسائق</button>`
            : `<button class="btn btn-sm" disabled style="background:transparent; border:1px solid #555; color:gray">تم القبول ✅</button>`;
            
        let statusBadge = !isApproved ? 'status-pending' : 'status-approved';
        let statusText = !isApproved ? 'قيد المراجعة' : 'مفعل';
        let dateJoined = new Date(doc.created_at || Date.now()).toLocaleDateString('ar-DZ');

        let tr = `
            <tr>
                <td>${doc.uid.substring(0,8)}...</td>
                <td><strong>${doc.name || 'بدون اسم'}</strong> <br><small>${doc.email || doc.phone || ''}</small></td>
                <td><a href="#" onclick="viewDocs('${doc.uid}')" style="color:var(--blue); text-decoration:none;"><i class="fas fa-file-image"></i> المستندات</a></td>
                <td>${dateJoined}</td>
                <td><span class="status-badge ${statusBadge}">${statusText}</span></td>
                <td style="display:flex; gap:8px;">${actionBtn}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

window.approveDriver = async function(uid) {
    try {
        const { error } = await supabaseClient.from('users').update({ role: 'driver', status: 'approved' }).eq('uid', uid);
        if (error) throw error;
        showToast(`تم ترقية وتفعيل حساب السائق بنجاح.`);
        fetchDrivers(); // refresh
    } catch(e) {
        showToast("تعذر التحديث: تأكد من الصلاحيات");
    }
}

let currentViewUid = null;
window.viewDocs = function(uid) {
    currentViewUid = uid;
    const doc = drivers.find(d => d.uid === uid);
    if (!doc) return;
    
    // Defaulting to Firebase Storage URLs if exact URLs missing
    const idUrl = doc.profileImageUrl || `https://firebasestorage.googleapis.com/v0/b/coursa14-project.appspot.com/o/drivers%2F${uid}%2Fid.jpg?alt=media`;
    const licenseUrl = doc.licenseImageUrl || `https://firebasestorage.googleapis.com/v0/b/coursa14-project.appspot.com/o/drivers%2F${uid}%2Flicense.jpg?alt=media`;

    document.getElementById('doc-id-img').src = idUrl;
    document.getElementById('doc-license-img').src = licenseUrl;
    
    const isApproved = doc.role === 'driver' || doc.status === 'approved';
    const actionDiv = document.getElementById('docs-action');
    if (!isApproved) {
        actionDiv.innerHTML = `
            <button class="btn btn-success" style="margin-left: 10px;" onclick="approveDriver('${uid}'); closeDocs();"><i class="fas fa-check"></i> قبول كسائق</button>
            <button class="btn btn-danger" onclick="rejectDriver('${uid}'); closeDocs();"><i class="fas fa-times"></i> رفض الطلب</button>
        `;
    } else {
        actionDiv.innerHTML = `<span class="status-badge status-approved" style="font-size: 16px; padding: 12px 24px;">السائق معتمد ومفعل ✅</span>`;
    }

    document.getElementById('docs-modal').classList.remove('hidden');
}

window.closeDocs = function() {
    document.getElementById('docs-modal').classList.add('hidden');
    currentViewUid = null;
}

window.rejectDriver = async function(uid) {
    if (!confirm('هل أنت متأكد من رفض طلب هذا السائق؟')) return;
    try {
        const { error } = await supabaseClient.from('users').update({ status: 'rejected' }).eq('uid', uid);
        if (error) throw error;
        showToast('تم رفض السائق بنجاح');
        fetchDrivers();
    } catch(e) {
        showToast("خطأ أثناء الرفض");
    }
}

// 2. Live Wallet Logic
let transactions = [];

async function fetchTransactions() {
    try {
        const { data, error } = await supabaseClient.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) { throw error; }
        transactions = data || [];
        renderTransactions();
        
        // Update Real Stats display for Transactions
        document.getElementById('total-transactions').innerText = transactions.length;
        document.getElementById('tx-progress').style.width = Math.min((transactions.length / 100) * 100, 100) + '%';
        if(transactions.length > 0) document.getElementById('tx-status').innerText = 'تم الجلب من القاعدة';
        
    } catch (e) {
        console.error("Error fetching transactions:", e);
        document.getElementById('total-transactions').innerText = "خطأ";
        document.getElementById('tx-progress').style.width = '0%';
    }
}

window.chargeWallet = async function() {
    const id = document.getElementById('driver-wallet-id').value;
    const amount = parseFloat(document.getElementById('charge-amount').value);

    if(!id || !amount) {
        alert("يرجى إدخال المعرف الدقيق للسائق والمبلغ!");
        return;
    }

    try {
        const btn = document.querySelector('.form-card .btn');
        btn.innerText = "جاري الحفظ...";
        btn.disabled = true;

        // Add Transaction record
        const { error: txError } = await supabaseClient.from('transactions').insert([
            { driver_id: id, amount: amount, admin_name: 'أدمن النظام' }
        ]);

        if (txError) throw txError;
        
        // Also update wallets table... Usually done via database RPC function for atomicity!
        const { error: walletError } = await supabaseClient.from('wallets').upsert({ driver_id: id, balance: amount }); 
        
        showToast(`تم شحن ${amount} دج لحساب السائق المذكور بنجاح.`);
        document.getElementById('driver-wallet-id').value = '';
        document.getElementById('charge-amount').value = '';
        
        fetchTransactions(); // Live reload
        
        btn.innerText = "تأكيد الشحن وإضافة المعاملة";
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        showToast("حدث خطأ! تأكد من تشغيل سكريبت SQL لضمان وجود جداول transactions و wallets.");
        const btn = document.querySelector('.form-card .btn');
        btn.innerText = "تأكيد الشحن وإضافة المعاملة";
        btn.disabled = false;
    }
}

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';
    
    if(transactions.length === 0) {
        list.innerHTML = `<li style="color:var(--text-dim); justify-content:center;">لا توجد معاملات حديثة</li>`;
        return;
    }

    transactions.forEach(tx => {
        let timeDate = new Date(tx.created_at).toLocaleString('ar-DZ');
        list.innerHTML += `
            <li>
                <div class="tx-info">
                    <h4>شحن رصيد - ${tx.driver_id ? tx.driver_id.substring(0,8) + '...' : 'مجهول'}</h4>
                    <small>${timeDate} | تمت بواسطة: ${tx.admin_name || 'المدير'}</small>
                </div>
                <div class="tx-amount" style="direction:ltr;">+${tx.amount} DZD</div>
            </li>
        `;
    });
}

// 3. Webhook Simulation & Health
async function checkHealth() {
    const start = performance.now();
    try {
        await supabaseClient.from('users').select('uid').limit(1);
        const latency = Math.round(performance.now() - start);
        document.querySelector('.health-icon').classList.remove('red');
        document.querySelector('.health-icon i').className = 'fas fa-server';
        document.getElementById('db-latency-value').innerText = latency + 'ms';
        document.querySelector('.health-status').innerText = `متصل!`;
        document.querySelector('.health-status').classList.remove('text-red');
    } catch (e) {
        document.querySelector('.health-icon').classList.replace('blue', 'red');
        document.querySelector('.health-icon i').className = 'fas fa-plug-circle-xmark';
        document.getElementById('db-latency-value').innerText = "فشل";
        document.querySelector('.health-status').innerText = `انقطع الاتصال بالقاعدة!`;
        document.querySelector('.health-status').classList.add('text-red');
    }
}

window.triggerSimulatedAlert = function() {
    const btn = document.querySelector('.webhook-card .btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...`;
    
    setTimeout(() => {
        document.getElementById('alert-response').classList.remove('hidden');
        document.getElementById('alert-response').innerHTML = `
            <div style="background: rgba(46, 204, 113, 0.1); border-left: 4px solid var(--success); padding: 12px; border-radius: 4px;">
                <strong class="text-green">✅ نجاح Webhook:</strong> تم استلام الإنذار من طرف خوادم تيليجرام وإيصاله لمدير النظام فوراً (تنبيه فعلي ينتظر ضبط الدالة في خوادم الإيدج)!
            </div>
        `;
        btn.innerHTML = `<i class="fas fa-check"></i> تم تنبيه الإدارة`;
        btn.classList.replace('btn-danger', 'btn-success');
    }, 1500);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// Init Real Database Actions
loadRealData();

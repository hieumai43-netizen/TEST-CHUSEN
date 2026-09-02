(() => {
  const CONFIG_KEY = 'chusenFirebaseSetupV1';
  const authRoot = document.getElementById('authRoot');
  const appShell = document.getElementById('appShell');
  const authUserBtn = document.getElementById('authUserBtn');
  let auth = null;
  let db = null;
  let setup = loadSetup();
  let currentProfile = null;

  function loadSetup(){
    // Luôn dùng cấu hình Firebase đã đóng gói trong source code.
    // Bản cũ từng lưu cấu hình người dùng nhập vào localStorage; dữ liệu cũ đó
    // có thể chứa API key sai và ghi đè cấu hình đúng, gây lỗi auth/api-key-not-valid.
    try { localStorage.removeItem(CONFIG_KEY); } catch {}
    return window.CHUSEN_FIREBASE_DEFAULTS || {};
  }

  function configured(){
    const c=setup?.firebaseConfig;
    return !!(c && c.apiKey && c.authDomain && c.projectId && setup.adminEmail);
  }

  function esc(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function showRoot(html){ authRoot.innerHTML=html; authRoot.hidden=false; appShell.hidden=true; }
  function showApp(user, profile){
    currentProfile=profile;
    authRoot.hidden=true;
    appShell.hidden=false;
    const admin=isAdmin(user);
    authUserBtn.title=admin?'Mở quản lý người dùng':(user.email || 'Tài khoản');
    authUserBtn.classList.toggle('admin-access',admin);
    authUserBtn.innerHTML=admin
      ? '<span class="account-pill-icon">👑</span><span class="account-pill-text">Duyệt tài khoản</span><span class="pending-badge" id="pendingBadge" hidden>0</span>'
      : '<span class="account-pill-icon">👤</span><span class="account-pill-text">Tài khoản</span>';
    if(admin) updatePendingBadge();
    if(window.startChusenApp) window.startChusenApp();
  }
  function isAdmin(user){ return !!user?.email && user.email.toLowerCase()===String(setup.adminEmail||'').toLowerCase(); }

  function authToast(message){
    const el=document.getElementById('toast');
    if(!el) return;
    el.textContent=message;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2200);
  }

  async function updatePendingBadge(){
    const badge=document.getElementById('pendingBadge');
    if(!badge || !db) return;
    try{
      const snap=await db.collection('users').where('status','==','pending').get();
      badge.textContent=String(snap.size);
      badge.hidden=snap.size===0;
      authUserBtn.setAttribute('aria-label',snap.size?`Có ${snap.size} tài khoản chờ duyệt`:'Quản lý người dùng');
    }catch{
      badge.hidden=true;
    }
  }

  function renderSetup(message=''){
    showRoot(`<main class="auth-page"><section class="auth-card setup-card">
      <img src="assets/apple-touch-icon.png" class="auth-logo" alt="">
      <h1>Thiết lập đăng nhập</h1>
      <p class="auth-help">Chỉ cần làm một lần trên thiết bị quản trị. Lấy cấu hình Web App từ Firebase rồi dán vào đây.</p>
      ${message?`<div class="auth-error">${esc(message)}</div>`:''}
      <form id="setupForm" class="form-grid">
        <div class="field"><label>Email quản trị viên</label><input type="email" name="adminEmail" required value="${esc(setup.adminEmail||'')}" placeholder="email-cua-ban@gmail.com"></div>
        <div class="field"><label>Firebase configuration</label><textarea name="config" required rows="10" placeholder='Dán object firebaseConfig, ví dụ: { "apiKey": "...", "authDomain": "...", "projectId": "..." }'>${setup.firebaseConfig?esc(JSON.stringify(setup.firebaseConfig,null,2)):''}</textarea></div>
        <button class="primary-btn">Lưu cấu hình và khởi động</button>
      </form>
      <p class="small-note">File README trong gói ZIP có hướng dẫn bật Email/Password, tạo Firestore và dán Security Rules.</p>
    </section></main>`);
    document.getElementById('setupForm').onsubmit=e=>{
      e.preventDefault(); const f=new FormData(e.target);
      try{
        let raw=String(f.get('config')).trim();
        raw=raw.replace(/^const\s+firebaseConfig\s*=\s*/, '').replace(/;\s*$/, '');
        const config=Function(`"use strict"; return (${raw})`)();
        if(!config.apiKey||!config.authDomain||!config.projectId) throw new Error('Thiếu apiKey, authDomain hoặc projectId.');
        setup={adminEmail:String(f.get('adminEmail')).trim().toLowerCase(),firebaseConfig:config};
        localStorage.setItem(CONFIG_KEY,JSON.stringify(setup)); location.reload();
      }catch(err){ renderSetup('Cấu hình chưa đúng: '+err.message); }
    };
  }

  function renderLogin(message=''){
    showRoot(`<main class="auth-page"><section class="auth-card">
      <img src="assets/apple-touch-icon.png" class="auth-logo" alt="">
      <h1>Chusen Manager</h1>
      <p class="auth-help">Đăng nhập bằng email đã được quản trị viên phê duyệt.</p>
      ${message?`<div class="auth-error">${esc(message)}</div>`:''}
      <div class="auth-tabs"><button class="active" data-mode="login">Đăng nhập</button><button data-mode="register">Đăng ký</button></div>
      <form id="authForm" class="form-grid">
        <input type="hidden" name="mode" value="login">
        <div class="field name-field" hidden><label>Tên hiển thị</label><input name="displayName" placeholder="Tên của bạn"></div>
        <div class="field"><label>Email</label><input type="email" name="email" required autocomplete="email"></div>
        <div class="field"><label>Mật khẩu</label><input type="password" name="password" minlength="6" required autocomplete="current-password"></div>
        <button class="primary-btn submit-auth">Đăng nhập</button>
        <button class="link-btn forgot-btn" type="button">Quên mật khẩu</button>
      </form>
      <p class="small-note">Sau khi đăng ký, tài khoản sẽ ở trạng thái chờ. Chỉ khi quản trị viên phê duyệt bạn mới vào được app.</p>
    </section></main>`);
    const form=document.getElementById('authForm');
    document.querySelectorAll('.auth-tabs button').forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll('.auth-tabs button').forEach(x=>x.classList.toggle('active',x===btn));
      const reg=btn.dataset.mode==='register'; form.mode.value=reg?'register':'login';
      form.querySelector('.name-field').hidden=!reg;
      form.querySelector('.submit-auth').textContent=reg?'Tạo tài khoản':'Đăng nhập';
      form.querySelector('.forgot-btn').hidden=reg;
    });
    form.onsubmit=async e=>{
      e.preventDefault(); const f=new FormData(form); const email=String(f.get('email')).trim().toLowerCase(); const password=String(f.get('password'));
      try{
        if(f.get('mode')==='register'){
          const cred=await auth.createUserWithEmailAndPassword(email,password);
          try{
            await createPendingProfile(cred.user,String(f.get('displayName')).trim());
            renderPending(email,'Đã gửi yêu cầu. Hãy báo cho quản trị viên phê duyệt.');
          }catch(profileErr){
            if(isPermissionError(profileErr)) renderFirestoreHelp(email,firebaseError(profileErr));
            else throw profileErr;
          }
        }else await auth.signInWithEmailAndPassword(email,password);
      }catch(err){ renderLogin(firebaseError(err)); }
    };
    form.querySelector('.forgot-btn').onclick=async()=>{
      const email=form.email.value.trim(); if(!email) return renderLogin('Hãy nhập email trước.');
      try{ await auth.sendPasswordResetEmail(email); renderLogin('Đã gửi email đặt lại mật khẩu.'); }
      catch(err){ renderLogin(firebaseError(err)); }
    };
  }

  function renderPending(email,message='Tài khoản đang chờ phê duyệt.'){
    showRoot(`<main class="auth-page"><section class="auth-card">
      <img src="assets/apple-touch-icon.png" class="auth-logo" alt=""><h1>Đang chờ phê duyệt</h1>
      <div class="pending-icon">⏳</div><p>${esc(message)}</p><p class="auth-email">${esc(email||'')}</p>
      <button class="secondary-btn" id="checkAgain">Kiểm tra lại</button>
      <button class="link-btn" id="logoutPending">Đăng xuất</button>
    </section></main>`);
    document.getElementById('checkAgain').onclick=()=>location.reload();
    document.getElementById('logoutPending').onclick=()=>auth.signOut();
  }

  function isPermissionError(err){
    return err?.code==='permission-denied' || err?.code==='firestore/permission-denied';
  }

  async function createPendingProfile(user, displayName=''){
    const ref=db.collection('users').doc(user.uid);
    await ref.set({
      email:String(user.email||'').trim().toLowerCase(),
      displayName:String(displayName||user.displayName||'').trim(),
      status:'pending',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:false});
    return {email:user.email,displayName:String(displayName||user.displayName||'').trim(),status:'pending'};
  }

  function renderFirestoreHelp(email, detail=''){
    showRoot(`<main class="auth-page"><section class="auth-card">
      <img src="assets/apple-touch-icon.png" class="auth-logo" alt=""><h1>Chưa kết nối được Firestore</h1>
      <div class="pending-icon">🛠️</div>
      <p>Tài khoản Authentication đã tồn tại, nhưng app chưa được phép ghi yêu cầu chờ duyệt vào Firestore.</p>
      <p class="auth-email">${esc(email||'')}</p>
      ${detail?`<div class="auth-error">${esc(detail)}</div>`:''}
      <div class="small-note" style="text-align:left"><b>Quản trị viên cần làm một lần:</b><br>Firebase Console → Firestore Database → Rules → dán nội dung file <code>firestore.rules</code> → bấm Publish.</div>
      <button class="primary-btn" id="retryProfile">Thử tạo lại yêu cầu</button>
      <button class="link-btn" id="logoutFirestore">Đăng xuất</button>
    </section></main>`);
    document.getElementById('retryProfile').onclick=async()=>{
      const btn=document.getElementById('retryProfile'); btn.disabled=true; btn.textContent='Đang thử lại…';
      try{ await createPendingProfile(auth.currentUser); renderPending(email,'Đã tạo yêu cầu thành công. Hãy báo quản trị viên phê duyệt.'); }
      catch(err){ renderFirestoreHelp(email,firebaseError(err)); }
    };
    document.getElementById('logoutFirestore').onclick=()=>auth.signOut();
  }

  function firebaseError(err){
    const map={
      'auth/invalid-credential':'Email hoặc mật khẩu chưa đúng.','auth/email-already-in-use':'Email này đã được đăng ký.','auth/weak-password':'Mật khẩu phải có ít nhất 6 ký tự.','auth/invalid-email':'Địa chỉ email không hợp lệ.','auth/too-many-requests':'Thử quá nhiều lần. Hãy đợi một lúc.'
    };
    return map[err?.code]||err?.message||'Không thể xử lý yêu cầu.';
  }

  async function renderAdmin(){
    showRoot(`<main class="auth-page"><section class="auth-card admin-card">
      <div class="admin-head">
        <div><div class="admin-kicker">👑 QUẢN TRỊ VIÊN</div><h1>Quản lý người dùng</h1><p class="auth-help">Duyệt người đã thanh toán, khóa hoặc mở lại tài khoản.</p></div>
        <button class="secondary-btn" id="backApp">← Về ứng dụng</button>
      </div>
      <div class="admin-summary" id="adminSummary"><div><strong>—</strong><span>Chờ duyệt</span></div><div><strong>—</strong><span>Đang dùng</span></div><div><strong>—</strong><span>Đã khóa</span></div></div>
      <div id="userList" class="admin-list"><div class="empty">Đang tải danh sách…</div></div>
      <button class="link-btn" id="adminLogout">Đăng xuất tài khoản quản trị</button>
    </section></main>`);
    document.getElementById('backApp').onclick=()=>showApp(auth.currentUser,currentProfile||{status:'approved'});
    document.getElementById('adminLogout').onclick=()=>auth.signOut();
    try{
      const snap=await db.collection('users').orderBy('createdAt','desc').get();
      const rows=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
      const counts={pending:0,approved:0,blocked:0};
      rows.forEach(u=>counts[u.status] = (counts[u.status]||0)+1);
      document.getElementById('adminSummary').innerHTML=`<div><strong>${counts.pending||0}</strong><span>Chờ duyệt</span></div><div><strong>${counts.approved||0}</strong><span>Đang dùng</span></div><div><strong>${counts.blocked||0}</strong><span>Đã khóa</span></div>`;
      document.getElementById('userList').innerHTML=rows.length?rows.map(u=>{
        const status=u.status||'pending';
        const statusText={pending:'Chờ duyệt',approved:'Đã duyệt',blocked:'Đã khóa'}[status];
        return `<article class="admin-user-card" data-uid="${u.id}">
          <div class="admin-user-main"><div class="admin-avatar">${esc((u.displayName||u.email||'?').slice(0,1).toUpperCase())}</div><div><b>${esc(u.displayName||'Chưa đặt tên')}</b><div class="row-sub">${esc(u.email)}</div></div><span class="admin-status ${status}">${statusText}</span></div>
          <div class="admin-actions">
            <button class="approve-btn" data-status="approved" ${status==='approved'?'disabled':''}>✓ Duyệt</button>
            <button class="pending-btn" data-status="pending" ${status==='pending'?'disabled':''}>⏳ Chờ</button>
            <button class="block-btn" data-status="blocked" ${status==='blocked'?'disabled':''}>🚫 Khóa</button>
          </div>
        </article>`;
      }).join(''):'<div class="empty">Chưa có người nào đăng ký.</div>';
      document.querySelectorAll('.admin-user-card button[data-status]').forEach(btn=>btn.onclick=async()=>{
        const card=btn.closest('.admin-user-card');
        const uid=card.dataset.uid;
        const status=btn.dataset.status;
        btn.disabled=true;
        try{
          await db.collection('users').doc(uid).update({status,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
          authToast(status==='approved'?'Đã phê duyệt tài khoản':status==='blocked'?'Đã khóa tài khoản':'Đã chuyển về chờ duyệt');
          await renderAdmin();
          await updatePendingBadge();
        }catch(err){ authToast(firebaseError(err)); btn.disabled=false; }
      });
    }catch(err){ document.getElementById('userList').innerHTML=`<div class="auth-error">${esc(firebaseError(err))}<br><small>Hãy kiểm tra Firestore Rules đã được Publish.</small></div>`; }
  }

  async function onUser(user){
    if(!user){ currentProfile=null; renderLogin(); return; }
    if(isAdmin(user)){ showApp(user,{status:'approved',admin:true}); return; }
    try{
      const ref=db.collection('users').doc(user.uid);
      let doc=await ref.get();
      if(!doc.exists){
        // Tự sửa các tài khoản đã được tạo trong Authentication ở bản cũ
        // nhưng chưa có hồ sơ Firestore.
        try{
          await createPendingProfile(user);
          doc=await ref.get();
        }catch(profileErr){
          if(isPermissionError(profileErr)){ renderFirestoreHelp(user.email,firebaseError(profileErr)); return; }
          throw profileErr;
        }
      }
      const profile=doc.data();
      if(profile.status==='approved') showApp(user,profile);
      else if(profile.status==='blocked') renderPending(user.email,'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên.');
      else renderPending(user.email);
    }catch(err){ renderLogin(firebaseError(err)); }
  }

  authUserBtn.onclick=()=>{
    const user=auth?.currentUser; if(!user)return;
    if(isAdmin(user)) renderAdmin();
    else if(confirm(`${user.email}\n\nBạn muốn đăng xuất?`)) auth.signOut();
  };

  if(!configured()){ renderSetup(); return; }
  try{
    firebase.initializeApp(setup.firebaseConfig);
    auth=firebase.auth(); db=firebase.firestore();
    window.chusenDb=db;
    auth.onAuthStateChanged(onUser);
  }catch(err){ renderSetup(err.message); }
})();

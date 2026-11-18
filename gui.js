/* CADVIEW Studio GUI 1.4 – layout and progressive UX only.
   The existing importer, viewer, materials, measurement and export remain in app.js. */
(() => {
  const $ = id => document.getElementById(id);
  const safeStore = {
    get(k){try{return localStorage.getItem(k)}catch{return null}},
    set(k,v){try{localStorage.setItem(k,v)}catch{}}
  };
  const panelButtons = [...document.querySelectorAll('[data-panel]')];
  const panelKeys = new Set(panelButtons.map(b=>b.dataset.panel));
  const panelLabels = {
    de:{material:'Material',transform:'Ausrichten',section:'Schnitt',display:'Ansicht',measure:'Messen'},
    en:{material:'Materials',transform:'Transform',section:'Section',display:'View',measure:'Measure'}
  };
  const copy = {
    de:{
      note:'Komponenten gezielt bearbeiten · Änderungen wirken auf die Auswahl.',
      welcome:'Dein 3D-Arbeitsplatz',welcomeBody:'Modell öffnen oder Demo testen. Mit der Maus drehen und zoomen. Mit 0 die Ansicht zurücksetzen.',
      demo:'Demo testen',help:'Steuerung anzeigen',reset:'⟲ Einpassen',recover:'Ansicht zurücksetzen',
      empty:'Keine 3D-Flächen sichtbar. Nutze „Einpassen“ oder „Demo testen“.',
      shortcut:'Ansicht 0: Kamera und Sichtbarkeit zurücksetzen.'
    },
    en:{
      note:'Edit selected parts · Changes apply to the current selection.',
      welcome:'Your 3D workspace',welcomeBody:'Open a CAD file or try the demo. Drag to orbit, scroll to zoom. Press 0 to reset the view.',
      demo:'Try demo',help:'Controls & shortcuts',reset:'⟲ Fit view',recover:'Reset view',
      empty:'No 3D surfaces visible. Use “Fit view” or “Try demo”.',
      shortcut:'View 0: Reset camera and component visibility.'
    }
  };
  const lang = () => $('languageSelect')?.value === 'en' ? 'en' : 'de';
  const translated = () => copy[lang()];
  function activatePanel(key, remember=true) {
    if(!panelKeys.has(key))return;
    for(const b of panelButtons){
      const on=b.dataset.panel===key;
      b.classList.toggle('active',on);
      b.setAttribute('aria-selected',String(on));
      b.tabIndex=on?0:-1;
    }
    for(const panel of document.querySelectorAll('.inspector-panel')){
      const on=panel.id==='panel-'+key;
      panel.classList.toggle('active',on);
      panel.hidden=!on;
    }
    if(remember)safeStore.set('cadview-active-panel',key);
    const right=$('rightSidebar');
    if(right && getComputedStyle(right).position==='fixed')right.classList.add('open');
  }
  panelButtons.forEach((b,i)=>{
    b.addEventListener('click',()=>activatePanel(b.dataset.panel));
    b.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?panelButtons.length-1:(i+(event.key==='ArrowLeft'?-1:1)+panelButtons.length)%panelButtons.length;
      activatePanel(panelButtons[next].dataset.panel);panelButtons[next].focus();
    });
  });
  activatePanel(safeStore.get('cadview-active-panel') || 'material',false);

  const currentTipsKey='cadview-welcome-v1.4-dismissed';
  const tips=$('welcomeTips');
  function hideTips(){tips?.classList.add('hidden');safeStore.set(currentTipsKey,'yes')}
  if(tips && safeStore.get(currentTipsKey)!=='yes')tips.classList.remove('hidden');
  $('welcomeDismiss')?.addEventListener('click',hideTips);
  $('welcomeDemo')?.addEventListener('click',()=>{$('demoButton')?.click();hideTips()});
  $('welcomeHelp')?.addEventListener('click',()=>{$('helpButton')?.click();hideTips()});
  $('openButton')?.addEventListener('click',hideTips);
  $('fileInput')?.addEventListener('change',hideTips);
  // Main viewport tools automatically reveal the relevant inspector panel.
  [ ['sectionButton','section'],['dimensionButton','measure'],['measureButton','measure'],['renderButton','display']]
    .forEach(([id,panel])=>$((id))?.addEventListener('click',()=>activatePanel(panel)));
  // Every tool remains accessible from the inspector when nothing is selected.
  $('viewportReset')?.addEventListener('click',hideTips);

  // Better first-load UX: compact nonmodal tip card, not an obstructing full-screen dialog.
  function translate() {
    const dict=translated();
    for(const b of panelButtons)b.textContent=panelLabels[lang()][b.dataset.panel];
    $('inspectorDescription').textContent=dict.note;
    $('welcomeTitle').textContent=dict.welcome;
    $('welcomeDescription').textContent=dict.welcomeBody;
    $('welcomeDemo').textContent=dict.demo;
    $('welcomeHelp').textContent=dict.help;
    $('viewportReset').textContent=dict.reset;
    $('renderRecover').textContent=dict.recover;
    // Leave the main translation logic in app.js as the only owner of standard labels.
  }
  $('languageSelect')?.addEventListener('change',translate);
  translate();

  // A small, nonintrusive help hint in the status bar to find shortcuts.
  const hint=document.createElement('button');
  hint.type='button';hint.className='status-help';hint.title='Keyboard shortcuts / Tastenkürzel';
  hint.textContent='?  F1  ·  0 = Fit';
  hint.addEventListener('click',()=>{$('helpButton')?.click()});
  document.querySelector('.viewport-bottom .status-right')?.prepend(hint);

  // Export and scene state are intentionally NOT reinitialized by the GUI code.
  // This keeps the installed PWA identity, app data and CAD model intact.
})();
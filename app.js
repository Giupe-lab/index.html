const $ = id => document.getElementById(id);
const STORAGE = "tradepulse_data_v1";

let data = {
  trades: [],
  accounts: [{id:"main",name:"Account principale",provider:"",capital:0,type:"Live"}],
  activeAccount: "main",
  currency: "EUR"
};

let currentMonth = new Date();
let equityChart = null;
let distributionChart = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved) data = {...data,...saved};
  } catch(e) {}
  if (!data.accounts.length) {
    data.accounts = [{id:"main",name:"Account principale",provider:"",capital:0,type:"Live"}];
  }
}

function save() {
  localStorage.setItem(STORAGE,JSON.stringify(data));
}

function trades() {
  return data.trades.filter(t=>t.accountId===data.activeAccount);
}

function money(n) {
  return new Intl.NumberFormat("it-IT",{
    style:"currency",currency:data.currency,maximumFractionDigits:2
  }).format(Number(n)||0);
}

function percent(n) {
  return (Number(n)||0).toLocaleString("it-IT",{maximumFractionDigits:2})+"%";
}

function total(arr) {
  return arr.reduce((s,t)=>s+Number(t.pnl||0),0);
}

function wins(arr) {
  return arr.filter(t=>Number(t.pnl)>0);
}

function losses(arr) {
  return arr.filter(t=>Number(t.pnl)<0);
}

function winRate(arr) {
  return arr.length ? wins(arr).length/arr.length*100 : 0;
}

function safe(s) {
  return String(s??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function dateKey(value) {
  const d=new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function metric(label,value,cls="",hint="") {
  return `<div class="metric-card">
    <div class="metric-label">${label}</div>
    <div class="metric-value ${cls}">${value}</div>
    <div class="metric-hint">${hint}</div>
  </div>`;
}

function calculate(arr) {
  const win=wins(arr);
  const loss=losses(arr);
  const grossWin=total(win);
  const grossLoss=Math.abs(total(loss));
  return {
    pnl:total(arr),
    win:win.length,
    loss:loss.length,
    count:arr.length,
    rate:winRate(arr),
    profitFactor:grossLoss?grossWin/grossLoss:(grossWin?Infinity:0),
    avgWin:win.length?grossWin/win.length:0,
    avgLoss:loss.length?total(loss)/loss.length:0,
    best:Math.max(0,...arr.map(t=>Number(t.pnl))),
    worst:Math.min(0,...arr.map(t=>Number(t.pnl)))
  };
}

function renderAccountSelector() {
  $("active-account").innerHTML=data.accounts.map(a=>
    `<option value="${a.id}" ${a.id===data.activeAccount?"selected":""}>${safe(a.name)}</option>`
  ).join("");
}

function renderDashboard() {
  const arr=trades();
  const s=calculate(arr);

  $("dashboard-cards").innerHTML =
    metric("Net P&L",money(s.pnl),s.pnl>=0?"positive":"negative")+
    metric("Win Rate",percent(s.rate))+
    metric("Operazioni",s.count)+
    metric("Trade vincenti",s.win,"positive")+
    metric("Trade in perdita",s.loss,"negative");

  $("dashboard-extra").innerHTML =
    metric("Profit Factor",Number.isFinite(s.profitFactor)?s.profitFactor.toFixed(2):"∞")+
    metric("Average Win",money(s.avgWin),"positive")+
    metric("Average Loss",money(s.avgLoss),"negative")+
    metric("Best Trade",money(s.best),"positive")+
    metric("Worst Trade",money(s.worst),"negative");

  const recent=[...arr].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);

  $("recent-trades").innerHTML=recent.length?recent.map(t=>`
    <div class="account-item">
      <div>
        <b>${safe(t.symbol)}</b>
        <div class="note">${new Date(t.date).toLocaleString("it-IT")} · ${t.direction}</div>
      </div>
      <b class="${t.pnl>=0?"positive":"negative"}">${money(t.pnl)}</b>
    </div>
  `).join(""):`<div class="empty">Nessun trade inserito.</div>`;

  drawEquity(arr);
}

function drawEquity(arr) {
  const ordered=[...arr].sort((a,b)=>a.date.localeCompare(b.date));
  let balance=0;
  const values=[0];
  const labels=["Inizio"];

  ordered.forEach(t=>{
    balance+=Number(t.pnl);
    values.push(balance);
    labels.push(new Date(t.date).toLocaleDateString("it-IT"));
  });

  if(equityChart) equityChart.destroy();

  equityChart=new Chart($("equity-chart"),{
    type:"line",
    data:{
      labels,
      datasets:[{
        label:"P&L cumulativo",
        data:values,
        borderColor:"#5788f5",
        backgroundColor:"rgba(87,136,245,.13)",
        fill:true,
        tension:.25,
        pointRadius:2
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:"#91a0b7",maxTicksLimit:8},grid:{display:false}},
        y:{ticks:{color:"#91a0b7"},grid:{color:"#2b3952"}}
      }
    }
  });
}

function renderTrades() {
  const query=$("trade-search").value.toLowerCase();
  const filter=$("trade-filter").value;

  const arr=[...trades()].sort((a,b)=>b.date.localeCompare(a.date)).filter(t=>{
    const matches=(t.symbol+" "+(t.notes||"")+" "+(t.setup||"")).toLowerCase().includes(query);
    const result=filter==="all"||(filter==="win"&&t.pnl>0)||(filter==="loss"&&t.pnl<0);
    return matches&&result;
  });

  $("trade-table").innerHTML=arr.length?arr.map(t=>`
    <tr>
      <td>${new Date(t.date).toLocaleString("it-IT")}</td>
      <td><b>${safe(t.symbol)}</b></td>
      <td>${safe(t.direction)}</td>
      <td>${t.volume||"—"}</td>
      <td class="${t.pnl>=0?"positive":"negative"}"><b>${money(t.pnl)}</b></td>
      <td>${safe(t.setup||"—")}</td>
      <td>
        <button class="secondary small-button" onclick="editTrade('${t.id}')">Modifica</button>
        <button class="delete-button small-button" onclick="deleteTrade('${t.id}')">Elimina</button>
      </td>
    </tr>
  `).join(""):`<tr><td colspan="7" class="empty">Nessuna operazione trovata.</td></tr>`;
}

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  $("month-label").textContent =
    new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric"
    }).format(currentMonth);

  const names = ["SAB", "LUN", "MAR", "MER", "GIO", "VEN", "DOM"];

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Sabato = 0, domenica = 6
  const offset = (first.getDay() + 1) % 7;

  let cells = [];

  for (let i = 0; i < offset; i++) cells.push(null);

  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }

  while (cells.length % 7) cells.push(null);

  const arr = trades();

  $("calendar-grid").innerHTML =
    names.map(n => `<div class="day-name">${n}</div>`).join("") +
    cells.map(d => {
      if (!d) return `<div class="day empty"></div>`;

      const key = dateKey(d);
      const daily = arr.filter(t => dateKey(t.date) === key);
      const pnl = total(daily);

      // Sabato e domenica sempre rossi
      const weekend = d.getDay() === 6 || d.getDay() === 0;

      let cls = weekend ? "weekend" : "";

      if (!weekend && daily.length) {
        cls = pnl >= 0 ? "profit" : "loss";
      }

      return `
        <div class="day ${cls}"
          onclick="addTradeForDay('${key}')">
          <div class="day-number">${d.getDate()}</div>
          <div>
            ${daily.length ? `
              <div class="day-pnl ${pnl >= 0 ? "positive" : "negative"}">
                ${money(pnl)}
              </div>
              <div class="day-detail">${daily.length} trade</div>
            ` : `
              <div class="day-detail">${weekend ? "Weekend" : ""}</div>
            `}
          </div>
        </div>
      `;
    }).join("");

  renderWeeklySummary(cells, arr);

  const monthly = arr.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const s = calculate(monthly);

  $("calendar-totals").innerHTML =
    metric("P&L mensile", money(s.pnl),
      s.pnl >= 0 ? "positive" : "negative") +
    metric("Trade", s.count) +
    metric("Win Rate", percent(s.rate)) +
    metric("Media per trade",
      money(s.count ? s.pnl / s.count : 0));
}

function renderWeeklySummary(cells,arr) {
  let weeks=[];

  for(let i=0;i<cells.length;i+=7) {
    const days=cells.slice(i,i+7).filter(Boolean);
    const daily=arr.filter(t=>days.some(d=>dateKey(d)===dateKey(t.date)));
    weeks.push({pnl:total(daily),count:daily.length});
  }

  $("weekly-summary").innerHTML=weeks.map((w,i)=>`
    <div class="week-box">
      <span>Settimana ${i+1}</span>
      <b class="${w.pnl>=0?"positive":"negative"}">${money(w.pnl)}</b>
      <span>${w.count} trade</span>
    </div>
  `).join("");
}

function renderStats() {
  const arr=trades();
  const s=calculate(arr);

  $("stats-cards").innerHTML=
    metric("Profit Factor",Number.isFinite(s.profitFactor)?s.profitFactor.toFixed(2):"∞")+
    metric("Expectancy",money(arr.length?s.pnl/arr.length:0),s.pnl>=0?"positive":"negative")+
    metric("Best Trade",money(s.best),"positive")+
    metric("Worst Trade",money(s.worst),"negative")+
    metric("Win Rate",percent(s.rate));

  if(distributionChart) distributionChart.destroy();

  distributionChart=new Chart($("distribution-chart"),{
    type:"doughnut",
    data:{
      labels:["Vincenti","Perdenti","Pareggio"],
      datasets:[{
        data:[s.win,s.loss,arr.length-s.win-s.loss],
        backgroundColor:["#42d392","#f07883","#65748c"],
        borderWidth:0
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:"bottom",labels:{color:"#dce6f7"}}}
    }
  });

  const groups={};

  arr.forEach(t=>{
    if(!groups[t.symbol]) groups[t.symbol]={pnl:0,count:0};
    groups[t.symbol].pnl+=Number(t.pnl);
    groups[t.symbol].count++;
  });

  $("symbol-performance").innerHTML=Object.entries(groups).length?
    Object.entries(groups).sort((a,b)=>b[1].pnl-a[1].pnl).map(([symbol,v])=>`
      <div class="account-item">
        <div><b>${safe(symbol)}</b><div class="note">${v.count} operazioni</div></div>
        <b class="${v.pnl>=0?"positive":"negative"}">${money(v.pnl)}</b>
      </div>
    `).join(""):`<div class="empty">Nessun dato.</div>`;

  const months={};

  arr.forEach(t=>{
    const d=new Date(t.date);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!months[key]) months[key]=[];
    months[key].push(t);
  });

  $("monthly-table").innerHTML=Object.entries(months)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([key,list])=>`
      <tr>
        <td>${new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric"}).format(new Date(key+"-01"))}</td>
        <td>${list.length}</td>
        <td>${percent(winRate(list))}</td>
        <td class="${total(list)>=0?"positive":"negative"}">${money(total(list))}</td>
      </tr>
    `).join("")||`<tr><td colspan="4" class="empty">Nessun dato.</td></tr>`;
}

function renderAccounts() {
  renderAccountSelector();

  $("account-list").innerHTML=data.accounts.map(a=>`
    <div class="account-item">
      <div>
        <b>${safe(a.name)}</b>
        <div class="note">${safe(a.provider||"Nessun broker")} · ${safe(a.type)}</div>
        <div class="note">Capitale: ${money(a.capital)}</div>
      </div>
      <div class="button-row">
        <button class="secondary small-button" onclick="selectAccount('${a.id}')">Apri</button>
        ${a.id!=="main"?`<button class="delete-button small-button" onclick="removeAccount('${a.id}')">Elimina</button>`:""}
      </div>
    </div>
  `).join("");
}

window.selectAccount=id=>{
  data.activeAccount=id;
  save();
  renderAll();
};

window.removeAccount=id=>{
  if(data.accounts.length<=1) return alert("Devi mantenere almeno un account.");
  if(!confirm("Eliminare questo account e i relativi trade?")) return;
  data.accounts=data.accounts.filter(a=>a.id!==id);
  data.trades=data.trades.filter(t=>t.accountId!==id);
  if(data.activeAccount===id) data.activeAccount=data.accounts[0].id;
  save();
  renderAll();
};

function renderAll() {
  renderAccountSelector();
  renderDashboard();
  renderTrades();
  renderCalendar();
  renderStats();
  renderAccounts();
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===id));

  const titles={
    dashboard:["Dashboard","Panoramica delle tue performance"],
    calendar:["Calendario P&L","Risultati giornalieri e settimanali"],
    trades:["Trade Journal","Storico delle operazioni"],
    stats:["Statistiche","Analisi delle performance"],
    accounts:["Account","Gestione dei tuoi account"],
    settings:["Impostazioni","Preferenze e backup"]
  };

  $("page-title").textContent=titles[id][0];
  $("page-subtitle").textContent=titles[id][1];

  if(id==="calendar") renderCalendar();
  if(id==="trades") renderTrades();
  if(id==="stats") renderStats();
  if(id==="accounts") renderAccounts();
}

function openTrade(trade=null,date=null) {
  $("trade-form").reset();
  $("trade-id").value=trade?.id||"";
  $("modal-title").textContent=trade?"Modifica trade":"Nuovo trade";

  $("trade-date").value=trade?.date||date||new Date().toISOString().slice(0,16);

  ["symbol","direction","volume","entry","exit","pnl","commission","setup","session","notes"].forEach(k=>{
    if(trade&&trade[k]!==undefined) $(k).value=trade[k];
  });

  $("trade-modal").classList.add("show");
}

function closeTrade() {
  $("trade-modal").classList.remove("show");
}

window.editTrade=id=>{
  const t=data.trades.find(t=>t.id===id);
  if(t) openTrade(t);
};

window.deleteTrade=id=>{
  if(!confirm("Eliminare definitivamente questa operazione?")) return;
  data.trades=data.trades.filter(t=>t.id!==id);
  save();
  renderAll();
};

window.addTradeForDay=key=>{
  openTrade(null,key+"T12:00");
};

$("trade-form").addEventListener("submit",e=>{
  e.preventDefault();

  const id=$("trade-id").value||crypto.randomUUID();

  const t={
    id,
    accountId:data.activeAccount,
    date:$("trade-date").value,
    symbol:$("symbol").value.trim().toUpperCase(),
    direction:$("direction").value,
    volume:Number($("volume").value)||0,
    entry:Number($("entry").value)||0,
    exit:Number($("exit").value)||0,
    pnl:Number($("pnl").value),
    commission:Number($("commission").value)||0,
    setup:$("setup").value,
    session:$("session").value,
    notes:$("notes").value
  };

  const index=data.trades.findIndex(x=>x.id===id);
  if(index>=0) data.trades[index]=t;
  else data.trades.push(t);

  save();
  closeTrade();
  renderAll();
});

function openAccount() {
  $("account-form").reset();
  $("account-modal").classList.add("show");
}

function closeAccount() {
  $("account-modal").classList.remove("show");
}

$("account-form").addEventListener("submit",e=>{
  e.preventDefault();

  const a={
    id:crypto.randomUUID(),
    name:$("account-name").value.trim(),
    provider:$("account-provider").value.trim(),
    capital:Number($("account-capital").value)||0,
    type:$("account-type").value
  };

  data.accounts.push(a);
  data.activeAccount=a.id;
  save();
  closeAccount();
  renderAll();
});

// NAVIGAZIONE
document.querySelectorAll(".nav").forEach(b=>{
  b.addEventListener("click",()=>showPage(b.dataset.page));
});

// MODALI
$("new-trade").onclick=()=>openTrade();
$("close-modal").onclick=$("cancel-modal").onclick=closeTrade;
$("add-account").onclick=openAccount;
$("close-account").onclick=$("cancel-account").onclick=closeAccount;

// CALENDARIO
$("prev-month").onclick=()=>{
  currentMonth.setMonth(currentMonth.getMonth()-1);
  renderCalendar();
};

$("next-month").onclick=()=>{
  currentMonth.setMonth(currentMonth.getMonth()+1);
  renderCalendar();
};

$("current-month").onclick=()=>{
  currentMonth=new Date();
  renderCalendar();
};

// FILTRI
$("trade-search").addEventListener("input",renderTrades);
$("trade-filter").addEventListener("change",renderTrades);

$("active-account").addEventListener("change",e=>{
  data.activeAccount=e.target.value;
  save();
  renderAll();
});

// CSV
$("export-csv").onclick=()=>{
  const columns=["date","symbol","direction","volume","entry","exit","pnl","commission","setup","session","notes"];

  const rows=[
    columns.join(";"),
    ...trades().map(t=>columns.map(k=>`"${String(t[k]??"").replace(/"/g,'""')}"`).join(";"))
  ];

  downloadFile("tradepulse-trades.csv","\ufeff"+rows.join("\n"),"text/csv;charset=utf-8");
};

// BACKUP
function downloadFile(name,content,type) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
  URL.revokeObjectURL(url);
}

$("backup").onclick=()=>{
  downloadFile("tradepulse-backup.json",JSON.stringify(data,null,2),"application/json");
};

$("restore").onchange=async e=>{
  const file=e.target.files[0];
  if(!file) return;

  try {
    const imported=JSON.parse(await file.text());

    if(!Array.isArray(imported.trades)||!Array.isArray(imported.accounts)) {
      throw new Error("Backup non valido");
    }

    if(confirm("Il backup sostituirà i dati attuali. Continuare?")) {
      data={...data,...imported};
      save();
      renderAll();
      alert("Backup importato correttamente.");
    }
  } catch(err) {
    alert("Impossibile importare il file.");
  }

  e.target.value="";
};

// IMPOSTAZIONI
$("currency").value=data.currency;

$("save-settings").onclick=()=>{
  data.currency=$("currency").value;
  save();
  renderAll();
  alert("Impostazioni salvate.");
};

// AVVIO
load();
$("currency").value=data.currency;
renderAll();

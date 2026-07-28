import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Check, LoaderCircle, Save, Sparkles } from 'lucide-react';
import './rate-engine.css';

type Benchmark = { id:string; code:string; name:string; rate_per_experience:number; tier:string; confidence_level:string; evidence_note?:string; source_note?:string };
type Scenario = Record<string, any>;

const DIMS = [
  { key:'exposure_score', name:'Exposure duration', hint:'How long is the product present across the stay?', low:'Brief', high:'Entire stay' },
  { key:'interaction_score', name:'Interaction depth', hint:'How actively does the guest engage with the product?', low:'Unused', high:'Essential' },
  { key:'environment_score', name:'Environment quality', hint:'Property prestige and guest experience standard', low:'Basic', high:'Luxury' },
  { key:'context_score', name:'Experience context', hint:'How naturally does the product fit the stay moment?', low:'Forced', high:'Inevitable' },
];

const PRESETS:Record<string,Scenario> = {
  sloom:{brand_name:'Sloom',exposure_score:5,interaction_score:4,environment_score:4,context_score:5,benchmark_code:'sloom',rooms_in_scope:7,campaign_days:90,average_occupancy_percentage:43.7,average_guests_per_room:1.7},
  tingtang:{brand_name:'Ting Tang',exposure_score:4,interaction_score:3,environment_score:4,context_score:4,benchmark_code:'tingtang',rooms_in_scope:7,campaign_days:90,average_occupancy_percentage:43.7,average_guests_per_room:1.7},
  wiser:{brand_name:'Wiser Health',exposure_score:4,interaction_score:2,environment_score:3,context_score:3,benchmark_code:'wiser',rooms_in_scope:25,campaign_days:90,average_occupancy_percentage:47,average_guests_per_room:1.4},
  sfera:{brand_name:'Sfera Bio Nutrition',exposure_score:4,interaction_score:3,environment_score:3,context_score:4,benchmark_code:'tingtang',rooms_in_scope:25,campaign_days:90,average_occupancy_percentage:47,average_guests_per_room:1.4},
};

const defaults:Scenario={id:null,name:'',brand_name:'',benchmark_code:'',exposure_score:null,interaction_score:null,environment_score:null,context_score:null,rooms_in_scope:'',campaign_days:'',average_occupancy_percentage:'',average_guests_per_room:'',assumptions:'',status:'draft'};

export default function RateEngine(){
  const [benchmarks,setBenchmarks]=useState<Benchmark[]>([]);
  const [scenarios,setScenarios]=useState<Scenario[]>([]);
  const [form,setForm]=useState<Scenario>({...defaults,...PRESETS.sfera});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{fetch('/.netlify/functions/rate-engine').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setBenchmarks(d.benchmarks||[]);setScenarios(d.scenarios||[])}).catch(e=>setMessage(e.message)).finally(()=>setLoading(false))},[]);

  const calc=useMemo(()=>calculate(form,benchmarks),[form,benchmarks]);
  const set=(key:string,value:any)=>setForm(f=>({...f,[key]:value}));
  const loadPreset=(key:string)=>{setForm({...defaults,...PRESETS[key]});setMessage('')};
  const loadScenario=(scenario:Scenario)=>setForm({...defaults,...scenario,benchmark_code:scenario.benchmark_code||''});

  const save=async()=>{
    if(!String(form.brand_name||'').trim()){setMessage('Enter a brand name before saving.');return;}
    setSaving(true);setMessage('');
    try{
      const r=await fetch('/.netlify/functions/rate-engine',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...form,name:form.name||`${form.brand_name} rate estimate`,recommended_rate:calc.rate,rationale:calc.rationale})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Save failed');
      setForm(f=>({...f,id:d.scenario.id,name:d.scenario.name}));
      setScenarios(rows=>[d.scenario,...rows.filter(x=>x.id!==d.scenario.id)]);
      setMessage('Saved');
    }catch(e){setMessage(e instanceof Error?e.message:'Save failed');}finally{setSaving(false)}
  };

  return <main className="rate-shell">
    <header className="rate-header"><a href="/" className="rate-back"><ArrowLeft size={17}/> Home</a><div className="rate-logo"><span>IRL</span><strong>RATE ENGINE</strong></div><button onClick={save} disabled={saving} className="rate-save"><Save size={17}/>{saving?'Saving…':'Save estimate'}</button></header>
    <section className="rate-hero"><div><p>Commercial intelligence</p><h1>Price the value of an experience, not just the placement.</h1><span>Score the quality of exposure, select an evidence anchor and calculate a defendable campaign estimate.</span></div><div className="hero-index"><small>IRL Index</small><strong>{calc.index??'—'}</strong><span>{calc.tierLabel}</span></div></section>
    {message&&<div className={`rate-message ${message==='Saved'?'ok':'bad'}`}>{message}</div>}
    <section className="rate-layout">
      <div className="rate-main">
        <section className="rate-card"><div className="card-heading"><p>Quick load</p><span>Use an existing example, then adjust it.</span></div><div className="preset-row">{Object.keys(PRESETS).map(k=><button onClick={()=>loadPreset(k)} key={k}>{PRESETS[k].brand_name}{k==='sfera'&&' ★'}</button>)}</div></section>
        <section className="rate-card"><div className="card-heading"><p>Brand and placement</p><span>The calculation can be saved as a reusable scenario.</span></div><label className="rate-field"><span>Brand name</span><input value={form.brand_name||''} onChange={e=>set('brand_name',e.target.value)} placeholder="e.g. Sfera Bio Nutrition"/></label><label className="rate-field"><span>Estimate name</span><input value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Optional working title"/></label></section>
        <section className="rate-card"><div className="card-heading"><p>IRL Index</p><span>Exposure × Interaction × Environment × Context</span></div><div className="dimension-grid">{DIMS.map(d=><article className="dimension-card" key={d.key}><div className="dimension-top"><strong>{d.name}</strong><b>{form[d.key]||'—'}</b></div><p>{d.hint}</p><div className="score-buttons">{[1,2,3,4,5].map(n=><button className={Number(form[d.key])===n?'on':''} onClick={()=>set(d.key,n)} key={n}>{Number(form[d.key])===n&&<Check size={12}/>} {n}</button>)}</div><div className="score-ends"><span>{d.low}</span><span>{d.high}</span></div></article>)}</div></section>
        <section className="rate-card"><div className="card-heading"><p>Benchmark anchor</p><span>Select the closest available market evidence.</span></div>{loading?<LoaderCircle className="spin"/>:<div className="benchmark-grid">{benchmarks.map(b=><button className={form.benchmark_code===b.code?'active':''} onClick={()=>set('benchmark_code',b.code)} key={b.code}><strong>{b.name}</strong><b>R{Number(b.rate_per_experience).toLocaleString('en-ZA')}</b><small>per experience</small><p>{b.evidence_note}</p><em>{human(b.confidence_level)} confidence</em></button>)}</div>}<Insight benchmark={form.benchmark_code} index={calc.index}/></section>
        <section className="rate-card"><div className="card-heading"><p>Campaign volume</p><span>Translate the recommended rate into a campaign estimate.</span></div><div className="volume-grid"><NumberField label="Rooms in scope" value={form.rooms_in_scope} set={v=>set('rooms_in_scope',v)}/><NumberField label="Campaign days" value={form.campaign_days} set={v=>set('campaign_days',v)}/><NumberField label="Average occupancy %" value={form.average_occupancy_percentage} set={v=>set('average_occupancy_percentage',v)}/><NumberField label="Average guests per room" value={form.average_guests_per_room} set={v=>set('average_guests_per_room',v)} step="0.1"/></div><label className="rate-field"><span>Assumptions and adjustments</span><textarea value={form.assumptions||''} onChange={e=>set('assumptions',e.target.value)} placeholder="Capture any commercial assumptions, premiums or exclusions."/></label></section>
      </div>
      <aside className="rate-rail">
        <div className="rate-result"><div className="result-top"><div><small>Recommended rate</small><strong>{calc.rate==null?'—':`R${calc.rate.toLocaleString('en-ZA')}`}</strong><span>per IRL Experience</span></div><Calculator size={26}/></div><div className="result-grid"><Result label="Estimated experiences" value={calc.experiences==null?'—':calc.experiences.toLocaleString('en-ZA')}/><Result label="Campaign fee" value={calc.fee==null?'—':`R${calc.fee.toLocaleString('en-ZA')}`}/></div><p>{calc.rationale}</p></div>
        <section className="saved-panel"><div><p>Saved estimates</p><span>{scenarios.length} scenarios</span></div>{scenarios.length===0?<small>No estimates saved yet.</small>:scenarios.slice(0,8).map(s=><button onClick={()=>loadScenario(s)} key={s.id}><strong>{s.brand_name}</strong><span>{s.normalised_score?`${s.normalised_score}%`:s.irl_index?`Index ${s.irl_index}`:'Draft'} · {s.estimated_campaign_fee?`R${Number(s.estimated_campaign_fee).toLocaleString('en-ZA')}`:'No fee yet'}</span></button>)}</section>
      </aside>
    </section>
  </main>
}

function calculate(form:Scenario,benchmarks:Benchmark[]){
  const scores=DIMS.map(d=>Number(form[d.key])||0);const index=scores.every(Boolean)?scores.reduce((a,b)=>a*b,1):null;
  const tierLabel=index==null?'Score all dimensions':index>=300?'High tier':index>=150?'Medium tier':index>=60?'Low tier':'Below threshold';
  const bench=benchmarks.find(b=>b.code===form.benchmark_code);let rate:number|null=null;let rationale='Score all dimensions and select a benchmark to generate a rate.';
  if(index&&bench){if(index>=300){rate=Math.round(Number(bench.rate_per_experience)*.95);rationale=`Index ${index} places this in the High tier. The rate is positioned close to the selected ${bench.name} anchor.`}else if(index>=150){rate=Math.round(65+((index-150)/149)*15);rationale=`Index ${index} sits in the Medium tier and is positioned within the R65–R80 sampling range.`}else{const position=Math.max(0,Math.min(1,(index-60)/89));rate=Math.round(40+position*20);rationale=`Index ${index} places this in the Low tier, using the selected benchmark as a conservative evidence anchor.`}}
  const rooms=Number(form.rooms_in_scope)||0,days=Number(form.campaign_days)||0,occ=Number(form.average_occupancy_percentage)||0,gpr=Number(form.average_guests_per_room)||0;
  const experiences=rooms&&days&&occ&&gpr?Math.round(rooms*days*(occ/100)*gpr):null;const fee=experiences&&rate!=null?experiences*rate:null;
  if(experiences&&fee!=null)rationale+=` At ${rooms} rooms, ${occ}% occupancy and ${gpr} guests per room over ${days} days, the model estimates ${experiences.toLocaleString('en-ZA')} experiences and a campaign fee of R${fee.toLocaleString('en-ZA')}.`;
  return{index,tierLabel,rate,experiences,fee,rationale};
}
function NumberField({label,value,set,step='1'}:{label:string;value:any;set:(v:string)=>void;step?:string}){return <label className="rate-field"><span>{label}</span><input type="number" step={step} value={value||''} onChange={e=>set(e.target.value)}/></label>}
function Result({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
function Insight({benchmark,index}:{benchmark:string;index:number|null}){if(!benchmark||!index)return null;const text=benchmark==='sloom'?'Sloom is currently single-sourced. Treat the premium as lower-confidence evidence.':benchmark==='tingtang'?'Ting Tang is the strongest current anchor, triangulated across three datasets.':index>100?'Wiser is a low-tier anchor; consider Ting Tang if the placement is materially stronger.':'Wiser is aligned to a conservative, lower-interaction placement.';return <div className="rate-insight"><Sparkles size={17}/><span>{text}</span></div>}
function human(v:any){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,(x:string)=>x.toUpperCase())}

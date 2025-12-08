import { useEffect, useRef, useState } from 'react';

interface AutocompleteProps {
  value: string;
  placeholder?: string;
  minChars?: number;
  fetchItems: (query: string) => Promise<any[]>;
  formatItem: (item: any) => string;
  getValue: (item: any) => string;
  onChange: (value: string, item?: any) => void;
  debounceMs?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Autocomplete({ value, placeholder, minChars=2, fetchItems, formatItem, getValue, onChange, debounceMs=250, disabled, ariaLabel }: AutocompleteProps){
  const [query, setQuery] = useState(value || '');
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const timerRef = useRef<number|undefined>(undefined);

  useEffect(()=>{ setQuery(value || ''); },[value]);

  useEffect(()=>{
    if(disabled) return;
    if(query.length < minChars){ setItems([]); setOpen(false); return; }
    if(timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        setLoading(true); setError(null);
        const list = await fetchItems(query);
        setItems(list); setOpen(true);
      } catch(e:any){ setError(e.message||'error'); }
      finally { setLoading(false); }
    }, debounceMs);
    return ()=>{ if(timerRef.current) window.clearTimeout(timerRef.current); };
  },[query, fetchItems, minChars, debounceMs, disabled]);

  return (
    <div style={{ position:'relative' }}>
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={e=>{ setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={()=>{ if(items.length>0) setOpen(true); }}
        onBlur={()=>{ setTimeout(()=>setOpen(false), 150); }}
      />
      {open && (items.length>0 || loading || error) && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ddd', borderRadius:4, zIndex:30, maxHeight:180, overflowY:'auto', fontSize:12 }}>
          {loading && <div style={{ padding:6 }}>Loading...</div>}
          {error && <div style={{ padding:6, color:'#c33' }}>Error</div>}
          {!loading && !error && items.map((it,i)=>(
            <div
              key={i}
              style={{ padding:'6px 8px', cursor:'pointer' }}
              onMouseDown={(e)=>{ e.preventDefault(); }}
              onClick={()=>{ const val = getValue(it); onChange(val, it); setQuery(val); setOpen(false); }}
            >
              {formatItem(it)}
            </div>
          ))}
          {!loading && !error && items.length===0 && query.length>=minChars && <div style={{ padding:6, color:'#555' }}>No matches</div>}
        </div>
      )}
    </div>
  );
}
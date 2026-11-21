// BETA: corrector manual no destructivo para el canal alpha de front/back.
// Envuelve applyWhiteSquare sin cambiar el flujo de carga ni de ImgBB.
(function () {
  function reviewMask(sourceUrl, cutoutUrl) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.id = 'cl-mask-editor';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2000;background:#151515;display:flex;flex-direction:column;color:#fff;font-family:inherit';
      ov.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;background:#222;border-bottom:1px solid #444">
        <b style="margin-right:8px">Fix edges</b>
        <button data-restore style="background:#087c45;color:#fff;border:1px solid #12c978;border-radius:8px;padding:9px 12px;font-weight:700">Restore</button>
        <button data-erase style="background:#333;color:#fff;border:1px solid #666;border-radius:8px;padding:9px 12px;font-weight:700">Erase</button>
        <label style="font-size:13px">Brush <input data-size type="range" min="2" max="70" value="16" style="width:100px;vertical-align:middle"></label>
        <button data-bg style="background:#333;color:#fff;border:1px solid #666;border-radius:8px;padding:9px 12px">White / dark</button>
        <button data-undo style="background:#333;color:#fff;border:1px solid #666;border-radius:8px;padding:9px 12px">Undo</button>
        <span style="flex:1"></span>
        <button data-cancel style="background:#333;color:#fff;border:1px solid #666;border-radius:8px;padding:9px 12px">Keep automatic</button>
        <button data-apply style="background:#00e676;color:#000;border:0;border-radius:8px;padding:10px 14px;font-weight:900">Apply correction</button>
      </div><div style="flex:1;min-height:0;overflow:auto;display:grid;place-items:center;padding:12px">
        <canvas style="display:block;max-width:96vw;max-height:calc(100vh - 90px);width:auto;height:auto;background:#fff;touch-action:none;cursor:crosshair"></canvas>
      </div>`;
      document.body.appendChild(ov);
      const canvas = ov.querySelector('canvas');
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      const src = new Image(), cut = new Image();
      let pixels, alpha, mode='restore', drawing=false, dark=false, history=[];
      const done = value => { ov.remove(); resolve(value); };

      function render() {
        if (!pixels) return;
        const frame = new ImageData(new Uint8ClampedArray(pixels.data), canvas.width, canvas.height);
        for (let i=0;i<alpha.length;i++) frame.data[i*4+3]=alpha[i];
        ctx.fillStyle=dark?'#222':'#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height;
        tmp.getContext('2d').putImageData(frame,0,0); ctx.drawImage(tmp,0,0);
      }
      function paint(e) {
        const r=canvas.getBoundingClientRect();
        const cx=(e.clientX-r.left)*canvas.width/r.width, cy=(e.clientY-r.top)*canvas.height/r.height;
        const radius=Number(ov.querySelector('[data-size]').value);
        for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(canvas.height-1,Math.ceil(cy+radius));y++) {
          for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(canvas.width-1,Math.ceil(cx+radius));x++) {
            const d=Math.hypot(x-cx,y-cy); if(d>radius) continue;
            const i=y*canvas.width+x, strength=Math.min(1,radius-d+.5);
            alpha[i]=mode==='restore'?Math.max(alpha[i],255*strength):Math.min(alpha[i],255*(1-strength));
          }
        }
        render();
      }
      ov.querySelector('[data-restore]').onclick=e=>{mode='restore';e.currentTarget.style.background='#087c45';ov.querySelector('[data-erase]').style.background='#333'};
      ov.querySelector('[data-erase]').onclick=e=>{mode='erase';e.currentTarget.style.background='#9b2c2c';ov.querySelector('[data-restore]').style.background='#333'};
      ov.querySelector('[data-bg]').onclick=()=>{dark=!dark;render()};
      ov.querySelector('[data-undo]').onclick=()=>{if(history.length){alpha=history.pop();render()}};
      ov.querySelector('[data-cancel]').onclick=()=>done(cutoutUrl);
      ov.querySelector('[data-apply]').onclick=()=>{
        const out=document.createElement('canvas'); out.width=canvas.width; out.height=canvas.height;
        const frame=new ImageData(new Uint8ClampedArray(pixels.data),canvas.width,canvas.height);
        for(let i=0;i<alpha.length;i++) frame.data[i*4+3]=alpha[i];
        out.getContext('2d').putImageData(frame,0,0); done(out.toDataURL('image/png'));
      };
      canvas.onpointerdown=e=>{history.push(alpha.slice());if(history.length>10)history.shift();drawing=true;canvas.setPointerCapture(e.pointerId);paint(e)};
      canvas.onpointermove=e=>{if(drawing)paint(e)};
      canvas.onpointerup=canvas.onpointercancel=()=>drawing=false;
      src.onload=()=>{cut.onload=()=>{
        canvas.width=cut.naturalWidth;canvas.height=cut.naturalHeight;
        const tmp=document.createElement('canvas');tmp.width=canvas.width;tmp.height=canvas.height;
        const t=tmp.getContext('2d',{willReadFrequently:true});t.drawImage(src,0,0,canvas.width,canvas.height);pixels=t.getImageData(0,0,canvas.width,canvas.height);
        t.clearRect(0,0,canvas.width,canvas.height);t.drawImage(cut,0,0,canvas.width,canvas.height);
        const initial=t.getImageData(0,0,canvas.width,canvas.height);alpha=new Uint8ClampedArray(canvas.width*canvas.height);
        for(let i=0;i<alpha.length;i++)alpha[i]=initial.data[i*4+3];render();
      };cut.onerror=()=>done(cutoutUrl);cut.src=cutoutUrl};
      src.onerror=()=>done(cutoutUrl);src.src=sourceUrl;
    });
  }

  function install() {
    if (typeof window.applyWhiteSquare !== 'function' || window.applyWhiteSquare.__maskEditorWrapped) return;
    const original=window.applyWhiteSquare;
    const wrapped=async function(processedUrl,size,fallbackUrl){
      if (/^data:image\/png/i.test(processedUrl) && fallbackUrl) processedUrl=await reviewMask(fallbackUrl,processedUrl);
      return original(processedUrl,size,fallbackUrl);
    };
    wrapped.__maskEditorWrapped=true; window.applyWhiteSquare=wrapped;
    console.log('✅ BETA mask editor ready');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

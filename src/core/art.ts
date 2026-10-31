/* Icon paths and Ping, the mascot. Static, trusted SVG markup only: never put user text in here. */
export const IC: Record<string, string> = {
  gear:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  aup:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  adn:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  teams:'<path d="M14 7h6a1 1 0 0 1 1 1v5a4 4 0 0 1-4 4h-1"/><rect x="3" y="6" width="12" height="12" rx="2"/><path d="M6.500 9.500h5M9 9.500V15"/><circle cx="18" cy="4" r="1.600"/>',
  tack:'<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  pin:'<path d="M12 21s-7-6.500-7-12a7 7 0 0 1 14 0c0 5.500-7 12-7 12z"/><circle cx="12" cy="9" r="2.500"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  portal:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  monitoring:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  "Access and accounts":'<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M17 6l3 3M14 9l2 2"/>',
  "Hardware":'<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
  "Software":'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  "Email":'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  "Network":'<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>',
  "VPN and remote access":'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
  "Firewall":'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 1.8.8 2.8 1.8 2.8C11 9 10 6 12 3z"/>',
  "Security incident":'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16h.01"/>',
  "Phishing":'<path d="M14 5v10a5 5 0 0 1-10 0v-3l3 3"/><circle cx="14" cy="3.5" r="1.5"/>',
  "Endpoint and malware":'<rect x="8" y="8" width="8" height="12" rx="4"/><path d="M12 8V5M9.5 5l1 2M14.5 5l-1 2M4 13h4M16 13h4M5 19l3-2M19 19l-3-2M5 8l3 2M19 8l-3 2"/>',
  "Backup and recovery":'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/>',
  "Servers and cloud":'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'
};
export const CAT_TONE: Record<string, string> = {"Access and accounts":"var(--amber)","Hardware":"var(--muted)","Software":"var(--accent)","Email":"var(--accent)","Network":"var(--good)","VPN and remote access":"var(--good)","Firewall":"var(--warn)","Security incident":"var(--warn)","Phishing":"var(--warn)","Endpoint and malware":"var(--warn)","Backup and recovery":"var(--amber)","Servers and cloud":"var(--muted)"};
/** An icon as SVG markup. Unknown names fall back to the Software icon. */
export function icon(n: string): string { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||IC["Software"])+"</svg>"; }

/** Ping as SVG markup. mood: happy | worried | sleepy | party | squish | dizzy | blush. */
export function mascot(mood: string, live?: boolean): string {
  const k='stroke="var(--m-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"',L=k.replace("var(--m-ink)","var(--m-limb)");
  const g='fill="none" stroke="var(--m-glow)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  let eyes='<rect x="42" y="38" width="9" height="11" rx="3"/><rect x="69" y="38" width="9" height="11" rx="3"/>',mouth='<path d="M53 54q7 6 14 0" '+g+'/>',extra="";
  let prompt='<path d="M32 61l4 3-4 3" '+g.replace('stroke-width="3"','stroke-width="2"')+' opacity=".85"/><path class="cur" d="M40 67h6" '+g.replace('stroke-width="3"','stroke-width="2"')+'/>';
  let led="#3DDC84",cheek=".7",dim="";
  if(mood==="worried"){
    eyes='<circle cx="46.5" cy="45" r="3.8"/><circle cx="73.5" cy="45" r="3.8"/>';
    mouth='<path d="M41 40l9-3M79 40l-9-3" '+g+'/><path d="M52 57q4-4 8 0t8 0" '+g+'/>';
    prompt='<path d="M34 60v3.5M34 67v.2" '+g.replace('stroke-width="3"','stroke-width="2.4"')+'/>';
    extra='<path d="M111 2c3 5 5 7 5 10a5 5 0 0 1-10 0c0-3 2-5 5-10z" fill="#8ED1FC" stroke="var(--m-limb)" stroke-width="2"/>';led="var(--warn)";
  }else if(mood==="sleepy"){
    eyes='';mouth='<path d="M42 45q4.5 4 9 0M69 45q4.5 4 9 0" '+g+'/><circle cx="60" cy="55" r="2.4" fill="var(--m-glow)"/>';
    prompt="";dim=' opacity=".55"';led="var(--faint)";
    extra='<path d="M104 0h8l-8 9h8M114 14h5l-5 6h5" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  }else if(mood==="party"){
    eyes='<path d="M42 47l4.5-6 4.5 6M69 47l4.5-6 4.5 6" '+g+'/>';
    mouth='<path d="M52 52h16a8 8 0 0 1-16 0z" fill="var(--m-glow)"/>';
    extra='<path d="M6 10v8M2 14h8M112 2v8M108 6h8M112 30v6M109 33h6" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>';led="var(--accent)";
  }
  if(mood==="squish"){
    eyes='<path d="M42 39l9 5-9 5M78 39l-9 5 9 5" '+g+'/>';
    mouth='<path d="M54 56q3-3 6 0t6 0" '+g+'/>';
    extra='<path d="M3 34l8 3M1 46h9M3 58l8-3M117 34l-8 3M119 46h-9M117 58l-8-3" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>';
  }else if(mood==="dizzy"){
    eyes='<path d="M42 39l9 9M51 39l-9 9M69 39l9 9M78 39l-9 9" '+g+'/>';
    mouth='<path d="M51 57q3-3 6 0t6 0t6 0" '+g+'/>';prompt='<path d="M32 64h3M38 64h3M44 64h3" '+g.replace('stroke-width="3"','stroke-width="2"')+'/>';
    extra='<path d="M8 2l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5zM112 2l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="var(--sun)" stroke="var(--m-ink)" stroke-width="1.6" stroke-linejoin="round"/>';led="var(--amber)";
  }else if(mood==="blush"){
    eyes='<path d="M42 46q4.5-6 9 0M69 46q4.5-6 9 0" '+g+'/>';
    mouth='<path d="M53 54q7 7 14 0" '+g+'/>';cheek="1";
    extra='<path d="M110 4c-3-5-10-2-8 4 1 3 8 8 8 8s7-5 8-8c2-6-5-9-8-4z" fill="var(--accent)" stroke="var(--m-ink)" stroke-width="1.8"/>';
  }
  return '<svg class="mascot'+(live?" live":"")+'" viewBox="0 0 120 106" aria-hidden="true"><g class="bod">'+
    '<path d="M60 84v7" fill="none" '+L+'/><path d="M47 91h26l4 8H43z" fill="var(--m-body)" '+k+'/>'+
    '<rect x="16" y="12" width="88" height="72" rx="16" fill="var(--m-body)" '+k+'/>'+
    '<path d="M24 30q2-8 11-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>'+
    '<rect x="25" y="21" width="70" height="52" rx="9" fill="var(--m-screen)" stroke="var(--m-ink)" stroke-width="2.5"/>'+
    '<path d="M29 30h62M29 38h62M29 46h62M29 54h62M29 62h62" stroke="var(--m-glow)" stroke-width="1" opacity=".07"/>'+
    '<g'+dim+'><ellipse cx="34" cy="51" rx="4" ry="2.5" fill="var(--m-cheek)" opacity="'+cheek+'"/><ellipse cx="86" cy="51" rx="4" ry="2.5" fill="var(--m-cheek)" opacity="'+cheek+'"/>'+
    '<g class="eyes" fill="var(--m-glow)">'+eyes+"</g>"+mouth+prompt+"</g>"+
    '<circle class="led" cx="93" cy="78" r="2.4" fill="'+led+'" stroke="var(--m-ink)" stroke-width="1.4"/>'+
    "</g>"+extra+"</svg>";
}

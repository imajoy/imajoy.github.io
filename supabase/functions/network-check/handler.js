/* Temporary owner diagnostic. No account, payment, storage or environment access. */
export function handleNetworkCheck(request) {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(request.method!=='GET')return new Response(JSON.stringify({error:'Use GET.'}),{status:405,headers});
  const nonce=new URL(request.url).searchParams.get('nonce')||'';
  if(!/^[a-f0-9-]{36}$/i.test(nonce))return new Response(JSON.stringify({error:'A diagnostic nonce is required.'}),{status:400,headers});
  const observed={};
  for(const name of ['cf-connecting-ip','x-real-ip'])observed[name]=(request.headers.get(name)||'').slice(0,128);
  return new Response(JSON.stringify({nonce,observed}),{headers});
}

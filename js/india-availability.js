/* Regional enquiries use the shared contact form; nothing is sent on navigation. */
export function indiaContact(plan='Online and Offline'){
 return 'contact.html?topic=india&plan='+encodeURIComponent(plan);
}

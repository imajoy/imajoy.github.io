/* Opens an email draft; this does not enrol anyone or send a message. */
export function indiaContact(plan='Online and Offline'){
 const subject='Ajoy Tools India availability — '+plan;
 const body='Hi Ajoy,\n\nPlease let me know when '+plan+' subscriptions and eligible Online trials become available for customers in India.\n\nMy Maya version:\nNumber of computers:\n';
 return 'mailto:contactmy3dart@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}

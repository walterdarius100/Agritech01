// No third-party SDK, retries or console logging. URLs and credentials come only from Edge environment.
export function createRpcDatabase({ url, secret, fetcher = fetch }) {
  async function call(name, args) {
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, {
      method:'POST', headers:{ 'Content-Type':'application/json', apikey:secret, Authorization:`Bearer ${secret}` },
      body:JSON.stringify(args), signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('database_unconfirmed');
    return response.json();
  }
  return { submit:args => call('contact_submit',args) };
}

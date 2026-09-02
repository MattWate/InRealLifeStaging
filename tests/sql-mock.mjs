export let calls = [];
let responder = () => [];
export function configure(handler = () => []) { calls = []; responder = handler; }
export function neon() {
  const sql = (strings, ...values) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    let promise;
    return { query, values, then(resolve, reject) {
      promise ||= Promise.resolve().then(() => { calls.push({ query, values }); return responder(query, values); });
      return promise.then(resolve, reject);
    } };
  };
  sql.transaction = async tasks => { calls.push({ query: 'BEGIN', values: [] }); const results = []; for (const task of tasks) results.push(await task); calls.push({ query: 'COMMIT', values: [] }); return results; };
  return sql;
}

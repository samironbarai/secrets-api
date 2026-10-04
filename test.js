// End-to-end check of every endpoint. Start the server first, then run: npm test
const BASE = process.env.BASE_URL || "http://localhost:3000";
let failed = 0;

async function call(method, url, { body, headers = {} } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

(async () => {
  const username = "tester_" + Date.now();
  const password = "test-password";
  const basic = { Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64") };
  let r;

  r = await call("GET", "/");
  check("GET / serves the docs page", r.status === 200 && String(r.data).includes("Secrets API"));

  r = await call("GET", "/random");
  check("GET /random needs no auth", r.status === 200 && typeof r.data.secret === "string");

  r = await call("POST", "/register", { body: { username, password } });
  check("POST /register creates a user", r.status === 201 && r.data.success);
  r = await call("POST", "/register", { body: { username, password } });
  check("POST /register rejects a taken username", r.status === 409);

  r = await call("GET", "/all?page=1");
  check("GET /all without credentials is 401", r.status === 401);
  r = await call("GET", "/all?page=1", { headers: basic });
  check("GET /all with basic auth returns a page", r.status === 200 && r.data.length > 0 && r.data.length <= 10);
  const page2 = await call("GET", "/all?page=2", { headers: basic });
  check("GET /all page 2 differs from page 1", page2.status === 200 && page2.data[0]?.id !== r.data[0].id);

  r = await call("GET", "/filter?score=5");
  check("GET /filter without a key is 401", r.status === 401);
  const { apiKey } = (await call("GET", "/generate-api-key")).data;
  r = await call("GET", `/filter?score=5&apiKey=${apiKey}`);
  check("GET /filter returns only scores >= 5", r.status === 200 && r.data.length > 0 && r.data.every((s) => s.emScore >= 5));

  r = await call("POST", "/get-auth-token", { body: { username, password: "wrong" } });
  check("POST /get-auth-token rejects a wrong password", r.status === 401);
  const { token } = (await call("POST", "/get-auth-token", { body: { username, password } })).data;
  const bearer = { Authorization: "Bearer " + token };
  check("POST /get-auth-token returns a token", typeof token === "string");

  r = await call("GET", "/secrets/1");
  check("GET /secrets/1 without a token is 401", r.status === 401);
  r = await call("GET", "/secrets/1", { headers: bearer });
  check("GET /secrets/1 with a token works", r.status === 200 && r.data.id === "1");

  r = await call("POST", "/secrets", { headers: bearer, body: { secret: "My test secret", score: 4 } });
  check("POST /secrets creates a secret", r.status === 201 && r.data.emScore === 4 && r.data.username === username);
  const id = r.data.id;

  r = await call("GET", "/user-secrets", { headers: bearer });
  check("GET /user-secrets lists my secret", r.status === 200 && r.data.length === 1 && r.data[0].id === id);

  r = await call("PUT", `/secrets/${id}`, { headers: bearer, body: { secret: "Replaced", score: 8 } });
  check("PUT /secrets/:id replaces it", r.status === 200 && r.data.secret === "Replaced" && r.data.emScore === 8);
  r = await call("PUT", `/secrets/${id}`, { headers: bearer, body: { score: 8 } });
  check("PUT without both fields is 400", r.status === 400);

  r = await call("PATCH", `/secrets/${id}`, { headers: bearer, body: { score: 2 } });
  check("PATCH /secrets/:id changes one field", r.status === 200 && r.data.secret === "Replaced" && r.data.emScore === 2);

  r = await call("DELETE", "/secrets/1", { headers: bearer });
  check("DELETE on someone else's secret is 403", r.status === 403);
  r = await call("DELETE", `/secrets/${id}`, { headers: bearer });
  check("DELETE /secrets/:id removes mine", r.status === 200);
  r = await call("GET", `/secrets/${id}`, { headers: bearer });
  check("Deleted secret is 404", r.status === 404);

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error("Could not reach the server at " + BASE + ":", err.message);
  process.exit(1);
});

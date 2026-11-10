// Prints the verified ABI surface of a contract on the Mezo explorer. Read-only.
// Usage: node scripts/abi-dump.mjs <test|main> <address> [regex]
const [net, addr, pat = "."] = process.argv.slice(2);
const host = net === "main" ? "api.explorer.mezo.org" : "api.explorer.test.mezo.org";
const get = async (a) => (await fetch(`https://${host}/api/v2/smart-contracts/${a}`)).json();
const c = await get(addr);
const impls = (c.implementations ?? []).map((i) => i.address_hash ?? i.address);
console.log(addr, "name", c.name, "verified", c.is_verified, "impls", impls);
for (const target of impls.length ? impls : [addr]) {
  const src = target === addr ? c : await get(target);
  console.log("--", target, src.name, "verified", src.is_verified);
  const re = new RegExp(pat, "i");
  for (const f of src.abi ?? []) {
    if (f.type !== "function" || !re.test(f.name)) continue;
    console.log(`${f.name}(${f.inputs.map((i) => i.type).join(",")}) ${f.stateMutability}`);
  }
}

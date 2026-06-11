/**
 * @suluk/testgen — generate a DETERMINISTIC conformance test suite from a v4 "Suluk" contract. The contract's
 * claims made executable: the server ENFORCES x-suluk-access on the wire, declared statuses hold, 2xx bodies
 * conform to their schemas, declared costs are well-formed. A pure function of the document. CANDIDATE tooling.
 */
export { generateTests, type TestgenOptions } from "./generate";
// money-correctness conformance (PARITY §2 checkout-resilience over the @suluk/stripe pricing primitives).
export { generateMoneyTests, type MoneyTestsOptions } from "./money";

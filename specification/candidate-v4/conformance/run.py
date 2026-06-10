#!/usr/bin/env python3
"""Conformance runner for the OpenAPI v4.0 Suluk candidate.
Validates valid/*.yaml (MUST pass) and invalid/*.yaml (MUST fail) against ../v4-meta-schema.json.
A conformant v4 tool's structural validator MUST agree with these verdicts.
Requires: pyyaml, jsonschema (Draft 2020-12). Tool authors may port to their own stack."""
import json, sys, glob, os
import yaml
from jsonschema import Draft202012Validator

here = os.path.dirname(os.path.abspath(__file__))
schema = json.load(open(os.path.join(here, "..", "v4-meta-schema.json")))
Draft202012Validator.check_schema(schema)
v = Draft202012Validator(schema)
fails = 0
for path in sorted(glob.glob(os.path.join(here, "valid", "*.yaml"))):
    errs = list(v.iter_errors(yaml.safe_load(open(path))))
    ok = not errs
    print(("PASS" if ok else "FAIL"), "valid/", os.path.basename(path), "" if ok else f"({len(errs)} unexpected errors)")
    if not ok: fails += 1
for path in sorted(glob.glob(os.path.join(here, "invalid", "*.yaml"))):
    errs = list(v.iter_errors(yaml.safe_load(open(path))))
    ok = bool(errs)   # invalid docs MUST produce errors
    print(("PASS" if ok else "FAIL"), "invalid/", os.path.basename(path), "" if ok else "(should have failed but validated!)")
    if not ok: fails += 1
print(f"\n{'ALL CONFORMANCE CHECKS PASS' if fails==0 else f'{fails} CHECK(S) FAILED'}")
sys.exit(1 if fails else 0)

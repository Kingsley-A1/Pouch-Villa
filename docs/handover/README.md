# Handover guide

`Pouch-Villa-Platform-Guide.pdf` is the document handed to the client: eleven
pages covering the five settings that must be filled before the shop can trade,
staff access codes, adding a product, organising brands and device classes,
orders and payment proofs, the storefront, a phone quick-reference, what the
platform protects against, troubleshooting, and what is still waiting on the
client.

## Regenerating it

```
pip install reportlab
python3 docs/handover/build-guide.py     # run from the repository root
```

The script reads the client logo from `apps/pv-frontend/public/images/` and
writes the PDF next to itself. Edit the script, never the PDF — the PDF is a
build output that happens to be committed so the client can be sent a copy
without a Python toolchain.

#!/usr/bin/env python3
"""Copy contract ABIs from the Foundry build into the web app as typed constants."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'contracts', 'out')
targets = {'SkurVault': 'SkurVault.sol/SkurVault.json', 'SkurFactory': 'SkurFactory.sol/SkurFactory.json', 'SkurTestUSD': 'SkurTestUSD.sol/SkurTestUSD.json'}
os.makedirs(os.path.join(root, 'web', 'src', 'abi'), exist_ok=True)
for name, rel in targets.items():
    abi = json.load(open(os.path.join(out, rel)))['abi']
    with open(os.path.join(root, 'web', 'src', 'abi', f'{name}.ts'), 'w') as f:
        f.write(f'// Generated from contracts/out/{rel} by scripts/export-abi.py. Do not edit.\n')
        f.write(f'export const {name}Abi = {json.dumps(abi, indent=2)} as const;\n')
    print(name, len(abi), 'entries')

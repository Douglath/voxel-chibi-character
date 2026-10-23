"""Read iteration state; never infer approval or modify a character project."""
import argparse
import json
from pathlib import Path


def summarize(spec, spec_path=None):
    if not isinstance(spec, dict):
        raise ValueError('Spec must be an object')
    state = spec.get('revisionState') or {}
    if not isinstance(state, dict):
        raise ValueError('revisionState must be an object')
    for field in ('requirements', 'decisions', 'openIssues'):
        if not isinstance(state.get(field, []), list) or any(not isinstance(x, dict) for x in state.get(field, [])):
            raise ValueError(f'{field} must be a list of objects')
    requirements = state.get('requirements', [])
    decisions = state.get('decisions', [])
    warnings = []
    current = state.get('currentModel')
    if not isinstance(current, dict) or not current.get('revision'):
        warnings.append('Current revision not recorded; locate actual source/model before editing.')
    ids = [r.get('id') for r in requirements]
    if any(not isinstance(x, str) or not x for x in ids) or len(set(str(x) for x in ids)) != len(ids):
        warnings.append('Requirement IDs missing or duplicated; resolve references before editing.')
    by_id = {r['id']: r for r in requirements if isinstance(r.get('id'), str)}
    for r in requirements:
        if r.get('status') not in ('active', 'superseded'):
            warnings.append(f'Unclassified requirement: {r.get("id")}')
        replacement = r.get('supersededBy')
        if replacement and replacement not in by_id:
            warnings.append(f'Missing replacement for requirement {r.get("id")}: {replacement}')
        if replacement and r.get('status') == 'active':
            warnings.append(f'Active requirement also declares replacement: {r.get("id")}')
        seen = set()
        link = r
        while link and link.get('supersededBy'):
            key = link.get('id')
            if key in seen:
                warnings.append(f'Cyclic supersession at requirement: {key}')
                break
            seen.add(key)
            link = by_id.get(link['supersededBy'])
    for d in decisions:
        if d.get('result') not in ('accepted', 'rejected', 'pending'):
            warnings.append(f'Unclassified decision: {d.get("revision")}')
        if isinstance(current, dict) and d.get('revision') == current.get('revision') and d.get('result') == 'rejected':
            warnings.append('Current revision has rejected parts; inspect decision scope before reuse.')
    resolved = {}
    for field in ('currentModel', 'adoptedModel'):
        value = state.get(field)
        if value is not None and not isinstance(value, dict):
            warnings.append(f'{field} must be an object or null')
            continue
        if value and spec_path:
            for key in ('source', 'model'):
                name = value.get(key)
                if not isinstance(name, str) or not name:
                    warnings.append(f'{field}.{key} missing')
                    continue
                path = (Path(spec_path).resolve().parent / name).resolve()
                resolved[f'{field}.{key}'] = str(path)
                if not path.is_file():
                    warnings.append(f'Missing artifact: {field}.{key}: {path}')
    return {
        'currentModel': current,
        'adoptedModel': state.get('adoptedModel'),
        'activeRequirements': [r for r in requirements if r.get('status') == 'active'],
        'supersededRequirements': [r for r in requirements if r.get('status') == 'superseded'],
        'decisions': decisions,
        'openIssues': [i for i in state.get('openIssues', []) if i.get('status') != 'resolved'],
        'iteration': spec.get('iteration', {}),
        'lastCheck': state.get('lastCheck'),
        'resolvedPaths': resolved,
        'warnings': list(dict.fromkeys(warnings)),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec', type=Path)
    parser.add_argument('--strict', action='store_true', help='Exit nonzero for unresolved warnings')
    args = parser.parse_args()
    report = summarize(json.loads(args.spec.read_text(encoding='utf-8-sig')), args.spec)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict and report['warnings']:
        raise SystemExit(1)

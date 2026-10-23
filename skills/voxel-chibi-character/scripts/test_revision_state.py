import copy
import json
from pathlib import Path
import tempfile
import unittest
from read_revision_state import summarize


class StateTests(unittest.TestCase):
    def setUp(self):
        self.spec = {'customPhysics': {'keep': True}, 'revisionState': {
            'currentModel': {'revision': 'candidate', 'source': 'model.mjs', 'model': 'candidate.glb'},
            'adoptedModel': {'revision': 'approved', 'source': 'approved.mjs', 'model': 'approved.glb'},
            'requirements': [
                {'id': 'old', 'status': 'superseded', 'supersededBy': 'thin'},
                {'id': 'thin', 'status': 'active', 'part': 'cheek'},
                {'id': 'volume', 'status': 'active', 'part': 'outerHair'}],
            'decisions': [{'revision': 'approved', 'result': 'accepted'},
                          {'revision': 'candidate', 'result': 'pending'},
                          {'revision': 'discarded', 'result': 'rejected'}],
            'openIssues': [{'status': 'resolved'}, {'status': 'open'}]}}

    def test_fresh_read_keeps_independent_requirements_and_approval(self):
        # JSON roundtrip simulates a fresh process without chat history.
        result = summarize(json.loads(json.dumps(self.spec)))
        self.assertEqual([r['id'] for r in result['activeRequirements']], ['thin', 'volume'])
        self.assertEqual(result['currentModel']['revision'], 'candidate')
        self.assertEqual(result['adoptedModel']['revision'], 'approved')
        self.assertEqual(result['decisions'][1]['result'], 'pending')
        self.assertEqual(len(result['openIssues']), 1)
        self.assertFalse(result['warnings'])

    def test_read_does_not_modify_unknown_or_existing_fields(self):
        before = copy.deepcopy(self.spec)
        summarize(self.spec)
        self.assertEqual(self.spec, before)

    def test_rejected_current_is_not_silently_reused(self):
        self.spec['revisionState']['currentModel']['revision'] = 'discarded'
        self.assertTrue(any('rejected' in s for s in summarize(self.spec)['warnings']))

    def test_missing_artifacts_detected(self):
        with tempfile.TemporaryDirectory() as folder:
            result = summarize(self.spec, Path(folder)/'character-spec.json')
            self.assertEqual(len([w for w in result['warnings'] if w.startswith('Missing artifact')]), 4)

    def test_cycle_and_missing_replacement_detected(self):
        req = self.spec['revisionState']['requirements']
        req[1].update(status='superseded', supersededBy='old')
        self.assertTrue(any('Cyclic' in s for s in summarize(self.spec)['warnings']))
        req[1]['supersededBy'] = 'absent'
        self.assertTrue(any('Missing replacement' in s for s in summarize(self.spec)['warnings']))

    def test_legacy_does_not_invent_adoption(self):
        result = summarize({'delivery': {'status': 'passed'}})
        self.assertIsNone(result['adoptedModel'])
        self.assertTrue(result['warnings'])

    def test_malformed_state_fails_explicitly(self):
        with self.assertRaises(ValueError):
            summarize({'revisionState': {'requirements': [None]}})


if __name__ == '__main__':
    unittest.main()

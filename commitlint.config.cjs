/**
 * Conventional Commits rules. Commit messages must look like:
 *   <type>(optional scope): <subject>
 * e.g.  feat(react): add onLoad callback
 *       fix(pptx): strip phantom slideMaster from Content_Types
 *       docs: clarify pdf.js worker setup
 *
 * Allowed types are listed below. The release automation (release-please) uses
 * these types to decide version bumps and to group CHANGELOG entries:
 *   feat  -> minor bump   |   fix -> patch bump   |   feat!/fix! or
 *   a "BREAKING CHANGE:" footer -> major bump.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // a new feature
        'fix', // a bug fix
        'docs', // documentation only
        'style', // formatting, no code change
        'refactor', // neither a fix nor a feature
        'perf', // performance improvement
        'test', // adding or fixing tests
        'build', // build system / dependencies
        'ci', // CI configuration
        'chore', // tooling, housekeeping
        'revert', // reverts a previous commit
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
}

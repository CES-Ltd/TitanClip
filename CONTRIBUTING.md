# Contributing to TitanClip

Thank you for contributing to TitanClip! This document outlines the process for contributing code, documentation, and other improvements to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Review Expectations](#code-review-expectations)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

- Be respectful and inclusive in all interactions
- Focus on constructive feedback
- Collaborate openly and transparently

## Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 9.15 or higher
- **Git**: Version 2.x or higher
- **macOS**: 12+ (Windows 10+ or Ubuntu 20+ also supported)

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/ankurCES/ZeusClip.git
cd ZeusClip

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run in development mode
pnpm dev
```

## Development Workflow

### Branch Naming

Use descriptive branch names with the following format:

```
<type>/<short-description>
```

Examples:
- `feature/agent-gallery-search`
- `fix/ipc-route-matching`
- `docs/update-api-reference`
- `refactor/database-connections`

### Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style and documentation standards below

3. **Test locally**:
   ```bash
   # Type-check all packages
   pnpm typecheck
   
   # Run the app in dev mode
   pnpm dev
   ```

4. **Commit your changes** following the commit message guidelines

5. **Push and create a pull request**

## Pull Request Process

### Before Submitting

- [ ] Code is type-checked (`pnpm typecheck`)
- [ ] Changes tested locally
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with `main`

### PR Title Format

Use the same format as branch names:

```
<type>: <short-description>
```

Examples:
- `feat: Add agent gallery search functionality`
- `fix: Resolve IPC route matching issue`
- `docs: Update API reference documentation`

### PR Description Template

```markdown
## Summary
<Brief description of changes>

## Changes
- <Change 1>
- <Change 2>

## Testing
<How to test these changes>

## Related Issues
<Links to related issues>
```

### Review Process

1. **Submit PR** with complete description
2. **Automated checks** run (type-check, build)
3. **Code review** by team members
4. **Address feedback** and push updates
5. **Approval** from at least one reviewer
6. **Merge** by maintainer

## Code Review Expectations

### Reviewers Will Check

- **Correctness**: Does the code work as intended?
- **Type safety**: Are types properly defined and used?
- **Code style**: Does it follow project conventions?
- **Testing**: Are changes tested appropriately?
- **Documentation**: Is documentation updated?
- **Performance**: Are there performance implications?
- **Security**: Are there security concerns?

### Responding to Feedback

- Address all comments before requesting re-review
- If you disagree with feedback, discuss respectfully
- Push fixes as new commits (don't force push during review)
- Tag reviewers when ready for re-review

### Review Turnaround

- Aim to review PRs within 24-48 hours
- Mark PRs as "Changes Requested" with specific feedback
- Use "Approve" when ready to merge

## Testing Requirements

### Unit Tests

- Write tests for new utility functions
- Test edge cases and error conditions
- Use Vitest for unit testing

```bash
# Run tests in a package
cd server && pnpm test
```

### Manual Testing

For UI and integration changes:

1. **Run in dev mode**: `pnpm dev`
2. **Test the feature** end-to-end
3. **Verify no regressions** in related features
4. **Test on multiple platforms** (macOS, Windows, Linux) if applicable

### Test Coverage

While we don't enforce strict coverage requirements, aim for:

- **Critical paths**: Authentication, authorization, data integrity
- **Complex logic**: Algorithms, state management, IPC routing
- **Edge cases**: Error handling, empty states, boundary conditions

## Documentation Standards

### Code Comments

- Use JSDoc/TSDoc for public APIs
- Explain _why_ not _what_ (code should be self-explanatory)
- Keep comments up to date with code changes

```typescript
/**
 * Validates agent checkout request against current issue state.
 * @param issueId - The issue to checkout
 * @param agentId - The agent requesting checkout
 * @returns Checkout result with conflict details if rejected
 * @throws {ConflictError} If issue is already checked out
 */
async function checkoutIssue(issueId: string, agentId: string): Promise<CheckoutResult> {
  // Implementation
}
```

### Documentation Files

- Use Markdown (.md) format
- Use clear section headings (##, ###, ####)
- Include code examples in fenced code blocks with language specification
- Use tables for structured data
- Keep line length under 120 characters where possible

### Documentation Locations

| Type | Location |
|------|----------|
| Architecture | `/docs/architecture.md` |
| Development | `/docs/development.md` |
| API Reference | `/docs/api-reference.md` or `/skills/titanclip/references/api-reference.md` |
| IPC Reference | `/docs/ipc-reference.md` |
| Features | `/docs/native-features.md` |
| Production | `/docs/production-build.md` |
| Skills | `/skills/<skill-name>/SKILL.md` |

### Updating Documentation

- Update docs in the same PR as code changes
- Mark breaking changes clearly
- Include migration notes for API changes
- Update README if setup or usage changes

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring (no behavior change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, config, etc.)

### Subject Line

- Use imperative mood ("Add" not "Added")
- No period at the end
- Limit to 72 characters
- Be specific and descriptive

### Body

- Wrap at 72 characters
- Explain what and why (not how)
- Use bullet points for multiple changes

### Footer

- Reference issues: `Fixes #123`
- Add co-authors: `Co-Authored-By: Name <email>`
- Note breaking changes: `BREAKING CHANGE: <description>`

### Examples

```
feat: Add agent gallery search

- Implement search input in agent gallery
- Filter agents by name and role
- Add debounced search for performance

Fixes #45
```

```
fix: Resolve IPC route matching for dynamic segments

The regex pattern for matching IPC routes was not capturing
dynamic segments correctly, causing fallback to HTTP for all
agent-related calls.

Co-Authored-By: TitanClip <noreply@TitanClip.ing>
```

```
docs: Update API reference with new endpoints

- Add documentation for routines API
- Update authentication examples
- Fix broken links

Refs: HPC-11
```

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search open issues for similar questions
3. Create a new issue with your question

---

Thank you for contributing to TitanClip!

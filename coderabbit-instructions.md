Please perform a deep-dive, full-context review of this repository. Do not limit your analysis to the PR diff. Explicitly fetch and analyze all files within the `/components`, `/app`, and `/functions` and all other directories(folders.

Evaluate the codebase strictly against these criteria:

1. Security & Webhooks (Backend/Serverless):
- Analyze webhook endpoints for missing signature verification, insecure implementations, or lack of proper authentication.
- Scan for hardcoded credentials, exposed API keys, and verify that Firebase security rules or environment variables are handled correctly.
- Check for proper input sanitization to prevent injection attacks on the serverless functions.

2. Responsive Design & Aspect Ratios (Frontend):
- Review the CSS/Tailwind classes within `/components` and `/app` for hardcoded widths or heights that break across different aspect ratios.
- Identify layout inconsistencies between mobile and desktop views.

3. UI/UX & SEO Readiness:
- Flag any useless frontend placeholders, generic placeholder text (e.g., "lorem ipsum"), or unoptimized test images left over from development.
- Verify that metadata, title tags, and semantic HTML structure are properly implemented for SEO optimization.

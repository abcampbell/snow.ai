# Math to Atoms v043 — make the summary controls match their limits

Reach and use still run from 0–100%. The common improvement control now stops
at the most restrictive of the energy, production-cost and project-time bounds:
80% with all three default residual shares at 20%. Its hint states the maximum.
The result sentence reports the actual common improvement after this bound.

Changing minimums updates the slider maximum and reduces its selected value if
needed. Old summary URLs requesting 100% local gain are normalized to the allowed
maximum, including the shared case URL and links to the full model. A 100%
residual assumption leaves no shared gain; the gain input becomes zero/disabled
without invalid fill percentages. Reset restores the 25/50/40/20 default case.

This is the summary's single common-gain shortcut. The full model retains the
per-sector calculation and residual bounds introduced in v042. No new scientific
ceiling is introduced; all maximums derive from the existing editable minimums.

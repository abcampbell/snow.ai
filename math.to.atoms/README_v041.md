# Math to Atoms v041 — total energy spending versus savings

The energy card now states the calculation explicitly: bill $12T/yr × 5% =
$600B/yr saved at the default settings. All numerical assumptions and estimates
are unchanged. The $12T base remains the illustrative 10% share of a $120T
nominal reference economy, not a measured current-year global energy bill.

Adds the IEA historical benchmark of around $9T/year average global consumer
energy bills over 2019–23, in 2023 USD at market exchange rates. Source: IEA,
Strategies for Affordable and Fair Clean Energy Transitions (2024), figure 1.2.
Fuel inputs to power generation are included in electricity rather than added
again. The oil history is a price proxy; it does not determine the bill base.
The spending base is held fixed through the rollout, not forecast to grow.

The user's oil demand × price chart does not by itself establish that this
all-energy spending assumption is too low. An upstream crude value also differs
from final consumer spending on refined products. No larger total is invented.

Build: use the checked-in snapshot for the first generator run, regenerate the
snapshot using its Node helper, then rerun the generator. Browser coverage
checks the bill/saving distinction and historical benchmark as well as existing
slider, GDP, timeline, synthesis placement and responsive behavior.

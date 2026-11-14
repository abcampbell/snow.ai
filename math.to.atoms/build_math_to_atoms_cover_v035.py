"""Build the aligned, explicitly dated cover and GDP accounting explanation."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
cover=(ROOT/'math_to_atoms_cover_v034.html').read_text(encoding='utf-8')
cover=cover.replace('math_to_atoms_cover_v034.css','math_to_atoms_cover_v035.css').replace('math_to_atoms_cover_v034.mjs','math_to_atoms_cover_v035.mjs').replace('Campbell · Math to Atoms · v034','Campbell · Math to Atoms · v035')
charts=(ROOT/'math_to_atoms_snapshot_v035.html').read_text(encoding='utf-8')
cover=re.sub(r'(<div class="snapshot-grid" data-cover-charts>).*?(</div><p class="snapshot-note")',lambda m:m[1]+charts+m[2],cover,count=1,flags=re.S)
cover=cover.replace('<span><i></i>History</span><span><i class="reference"></i>Reference trend</span><span><i class="change"></i>Your change</span>','<span><i></i>Recorded history</span><span><i class="reference"></i>Extended trend</span><span><i class="change"></i>Assumed change</span>')
cover=re.sub(r'(<p class="snapshot-note" data-cover-note>).*?(</p>)',lambda m:m[1]+'Recorded history ends at the latest data. Dashed trends and blue gains run to 2046; every end marker uses that same year. The full annual gain builds up gradually.'+m[2],cover,count=1,flags=re.S)
note='<p class="gdp-heading-note">The dollar figure is gross savings and avoided losses. Extra GDP has not yet been estimated.</p><details class="cover-gdp" id="gdp-explanation"><summary>What is missing before we can estimate GDP?</summary><div data-cover-gdp>'+ (ROOT/'math_to_atoms_gdp_v035.html').read_text(encoding='utf-8')+'</div></details>'
cover=cover.replace('<details class="cover-method" id="assumptions">',note+'<details class="cover-method" id="assumptions">')
cover=cover.replace('Energy is included once in the savings total. Health is counted separately.','Energy and other production costs are assumed to be separate; overlap still needs checking. Health is counted separately.')
cover=cover.replace('<span>Annual savings</span>','<span>Gross savings</span>')
(ROOT/'math_to_atoms_cover_v035.html').write_text(cover,encoding='utf-8')
print('Built v035 cover with equal plot geometry, end-year markers and GDP breakdown.')

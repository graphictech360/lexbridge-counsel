import { cases, draftTemplates, jurisdictions, practiceAreas, statutes } from './data.js';

const storageKeys = {
  disclaimer: 'lexbridgeDisclaimerAccepted',
  bookmarks: 'lexbridgeBookmarks',
  matters: 'lexbridgeMatters',
  reminders: 'lexbridgeReminders',
  notes: 'lexbridgeNotes',
  drafts: 'lexbridgeDrafts',
};

const pageTitles = {
  dashboard: 'Dashboard',
  research: 'AI Legal Research',
  cases: 'Case Library',
  statutes: 'Statute Finder',
  drafting: 'Legal Drafting',
  chamber: 'Chamber Management',
  notes: 'Lawyer Notes',
  reminders: 'Hearing Reminders',
  bookmarks: 'Bookmarks',
  citations: 'Citation Export',
};

const state = {
  route: 'dashboard',
  caseSearch: '',
  caseJurisdiction: 'all',
  casePractice: 'all',
  caseCourt: 'all',
  statuteJurisdiction: 'all',
  statutePractice: 'all',
  statuteSearch: '',
  lastAnswerText: '',
  lastCitationText: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function init() {
  seedDemoData();
  populateSelects();
  bindEvents();
  renderAll();
  setRoute(location.hash.replace('#', '') || 'dashboard');
  setupPwa();
  setupDisclaimer();
}

function populateSelects() {
  fillSelect('[data-research-jurisdiction]', [{ id: 'all', name: 'All jurisdictions (grouped)' }, ...jurisdictions]);
  fillSelect('[data-research-practice]', [{ id: 'all', name: 'All practice areas' }, ...practiceAreas.map((name) => ({ id: name, name }))]);
  fillSelect('[data-case-jurisdiction]', [{ id: 'all', name: 'All jurisdictions' }, ...jurisdictions]);
  fillSelect('[data-case-practice]', [{ id: 'all', name: 'All practice areas' }, ...practiceAreas.map((name) => ({ id: name, name }))]);
  fillSelect('[data-statute-jurisdiction]', [{ id: 'all', name: 'All jurisdictions (grouped)' }, ...jurisdictions]);
  fillSelect('[data-statute-practice]', [{ id: 'all', name: 'All practice areas' }, ...practiceAreas.map((name) => ({ id: name, name }))]);
  fillSelect('[data-draft-jurisdiction]', jurisdictions);
  fillSelect('[data-matter-jurisdiction]', jurisdictions);
  fillSelect('[data-matter-practice]', practiceAreas.map((name) => ({ id: name, name })));
  fillSelect('[data-draft-template]', draftTemplates.map((template) => ({ id: template.id, name: template.name })));

  const dateInput = $('[data-reminder-date]');
  if (dateInput) dateInput.value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

function fillSelect(selector, items) {
  const select = $(selector);
  if (!select) return;
  select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
}

function bindEvents() {
  $$('[data-route]').forEach((element) => {
    element.addEventListener('click', () => setRoute(element.dataset.route));
  });

  $('[data-case-search]')?.addEventListener('input', (event) => {
    state.caseSearch = event.target.value;
    renderCases();
  });
  $('[data-case-jurisdiction]')?.addEventListener('change', (event) => {
    state.caseJurisdiction = event.target.value;
    renderCases();
  });
  $('[data-case-practice]')?.addEventListener('change', (event) => {
    state.casePractice = event.target.value;
    renderCases();
  });
  $('[data-case-court]')?.addEventListener('change', (event) => {
    state.caseCourt = event.target.value;
    renderCases();
  });
  $('[data-statute-jurisdiction]')?.addEventListener('change', (event) => {
    state.statuteJurisdiction = event.target.value;
    renderStatutes();
  });
  $('[data-statute-practice]')?.addEventListener('change', (event) => {
    state.statutePractice = event.target.value;
    renderStatutes();
  });
  $('[data-statute-search]')?.addEventListener('input', (event) => {
    state.statuteSearch = event.target.value;
    renderStatutes();
  });
  $('[data-research-jurisdiction]')?.addEventListener('change', renderResearchScope);
  $('[data-research-practice]')?.addEventListener('change', renderResearchScope);

  $('[data-run-research]')?.addEventListener('click', runResearch);
  $('[data-fill-sample-question]')?.addEventListener('click', fillSampleQuestion);
  $('[data-save-answer]')?.addEventListener('click', saveAnswerAsNote);
  $('[data-generate-draft]')?.addEventListener('click', generateDraft);
  $('[data-save-draft]')?.addEventListener('click', saveDraft);
  $('[data-copy-draft]')?.addEventListener('click', () => copyText($('[data-draft-output]')?.textContent || '', 'Draft copied'));
  $('[data-add-matter]')?.addEventListener('click', addMatter);
  $('[data-add-note]')?.addEventListener('click', addNote);
  $('[data-add-reminder]')?.addEventListener('click', addReminder);
  $('[data-build-citations]')?.addEventListener('click', buildCitations);
  $('[data-copy-citations]')?.addEventListener('click', () => copyText(state.lastCitationText, 'Citation list copied'));
  $('[data-download-citations]')?.addEventListener('click', downloadCitations);
  $('[data-open-disclaimer]')?.addEventListener('click', openDisclaimer);
  $('[data-close-disclaimer]')?.addEventListener('click', closeDisclaimer);
  $('[data-accept-disclaimer]')?.addEventListener('click', acceptDisclaimer);

  window.addEventListener('hashchange', () => {
    const nextRoute = location.hash.replace('#', '') || 'dashboard';
    if (nextRoute !== state.route) setRoute(nextRoute);
  });

  document.addEventListener('click', handleActionClick);
}

function handleActionClick(event) {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    setRoute(routeTarget.dataset.route);
  }

  const target = event.target.closest('[data-action]');
  if (!target) return;

  const { action, id } = target.dataset;
  if (action === 'bookmark') toggleBookmark(id);
  if (action === 'copy-citation') copyCitation(id);
  if (action === 'case-note') createCaseNote(id);
  if (action === 'attach-case') attachCaseToMatter(id);
  if (action === 'copy-statute') copyStatute(id);
  if (action === 'delete-note') deleteItem(storageKeys.notes, id, renderNotes, 'Note deleted');
  if (action === 'delete-matter') deleteItem(storageKeys.matters, id, renderMatters, 'Matter deleted');
  if (action === 'delete-reminder') deleteItem(storageKeys.reminders, id, renderReminders, 'Reminder deleted');
  if (action === 'toggle-reminder') toggleReminder(id);
}

function setRoute(route) {
  const nextRoute = pageTitles[route] ? route : 'dashboard';
  state.route = nextRoute;
  location.hash = nextRoute;
  $('[data-page-title]').textContent = pageTitles[nextRoute];

  $$('[data-view]').forEach((view) => view.classList.toggle('is-active', view.dataset.view === nextRoute));
  $$('[data-route]').forEach((item) => item.classList.toggle('is-active', item.dataset.route === nextRoute));

  if (nextRoute === 'bookmarks') renderBookmarks();
  if (nextRoute === 'citations') renderCitationPicker();
  if (nextRoute === 'dashboard') renderDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAll() {
  renderResearchScope();
  renderDashboard();
  renderCases();
  renderStatutes();
  renderMatters();
  renderNotes();
  renderReminders();
  renderCitationPicker();
  renderBookmarks();
  renderDraftPlaceholder();
}

function renderResearchScope() {
  const jurisdiction = $('[data-research-jurisdiction]')?.value || 'all';
  const practice = $('[data-research-practice]')?.value || 'all';
  const scope = $('[data-research-scope]');
  if (!scope) return;

  const jurisdictionText =
    jurisdiction === 'all'
      ? 'All jurisdictions selected: answers will be grouped separately by Bangladesh, England & Wales, and United States.'
      : `${getJurisdictionName(jurisdiction)} selected: answers will use only this jurisdiction's cases and statute/rule references.`;
  const practiceText = practice === 'all' ? 'All practice areas included.' : `${practice} filter active.`;
  scope.innerHTML = `
    <strong>${escapeHtml(jurisdictionText)}</strong>
    <span>${escapeHtml(practiceText)} No cross-jurisdiction mixing.</span>
  `;
}

function renderDashboard() {
  const matters = readStore(storageKeys.matters);
  const reminders = readStore(storageKeys.reminders);
  const bookmarks = readStore(storageKeys.bookmarks);
  const metrics = [
    ['Curated cases', cases.length],
    ['Statute references', statutes.length],
    ['Open matters', matters.length],
    ['Saved authorities', bookmarks.length],
  ];
  $('[data-dashboard-metrics]').innerHTML = metrics
    .map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');

  $('[data-jurisdiction-summary]').innerHTML = jurisdictions
    .map((jurisdiction) => {
      const count = cases.filter((item) => item.jurisdiction === jurisdiction.id).length;
      const statuteCount = statutes.filter((item) => item.jurisdiction === jurisdiction.id).length;
      const areas = new Set(cases.filter((item) => item.jurisdiction === jurisdiction.id).map((item) => item.practiceArea)).size;
      return `
        <article class="jurisdiction-card">
          <span>${jurisdiction.shortName}</span>
          <strong>${jurisdiction.name}</strong>
          <p class="muted">${count} cases, ${statuteCount} statute refs, ${areas} practice areas</p>
        </article>
      `;
    })
    .join('');

  const upcoming = reminders
    .filter((item) => !item.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  $('[data-upcoming-reminders]').innerHTML = upcoming.length
    ? upcoming.map(renderReminderCompact).join('')
    : '<p class="muted">No upcoming hearing reminders yet.</p>';
}

function renderCases() {
  const filtered = getFilteredCases();
  $('[data-case-count]').textContent = `${filtered.length} case${filtered.length === 1 ? '' : 's'}`;
  $('[data-case-list]').innerHTML = filtered.length
    ? filtered.map(renderCaseCard).join('')
    : '<article class="bookmark-empty">No cases match the current filters.</article>';
}

function getFilteredCases() {
  const search = normalize(state.caseSearch);
  return cases.filter((item) => {
    const matchesSearch =
      !search ||
      normalize(
        [
          item.title,
          item.citation,
          item.court,
          item.year,
          item.location,
          item.facts,
          item.issue,
          item.decision,
          item.principle,
          item.keywords.join(' '),
        ].join(' '),
      ).includes(search);
    const matchesJurisdiction = state.caseJurisdiction === 'all' || item.jurisdiction === state.caseJurisdiction;
    const matchesPractice = state.casePractice === 'all' || item.practiceArea === state.casePractice;
    const matchesCourt = state.caseCourt === 'all' || item.court.includes(state.caseCourt);
    return matchesSearch && matchesJurisdiction && matchesPractice && matchesCourt;
  });
}

function renderCaseCard(item) {
  const bookmarked = isBookmarked(item.id);
  return `
    <article class="case-card">
      <div>
        <div class="case-meta">
          <span>${escapeHtml(getJurisdictionName(item.jurisdiction))}</span>
          <span>${escapeHtml(item.practiceArea)}</span>
          <span>${escapeHtml(item.year)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="case-meta">
          <span>${escapeHtml(item.court)}</span>
          <span>${escapeHtml(item.citation)}</span>
          <span>${escapeHtml(item.location)}</span>
        </div>
      </div>
      <div class="case-summary-grid">
        <div><strong>Issue</strong><span>${escapeHtml(item.issue)}</span></div>
        <div><strong>Principle</strong><span>${escapeHtml(item.principle)}</span></div>
        <div><strong>Decision</strong><span>${escapeHtml(item.decision)}</span></div>
        <div><strong>Lawyer note</strong><span>${escapeHtml(item.lawyerNote)}</span></div>
      </div>
      <div class="tag-row">
        ${item.statutes.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="case-actions">
        <button type="button" data-action="bookmark" data-id="${item.id}">${bookmarked ? 'Saved' : 'Bookmark'}</button>
        <button type="button" data-action="copy-citation" data-id="${item.id}">Copy citation</button>
        <button type="button" data-action="case-note" data-id="${item.id}">Note</button>
        <button type="button" data-action="attach-case" data-id="${item.id}">Attach to matter</button>
        <a class="compact-action" href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `;
}

function renderStatutes() {
  const search = normalize(state.statuteSearch);
  const filtered = statutes.filter((item) => {
    const matchesJurisdiction = state.statuteJurisdiction === 'all' || item.jurisdiction === state.statuteJurisdiction;
    const matchesPractice = state.statutePractice === 'all' || item.area === state.statutePractice;
    const matchesSearch =
      !search || normalize([item.title, item.section, item.area, item.note, getJurisdictionName(item.jurisdiction)].join(' ')).includes(search);
    return matchesJurisdiction && matchesPractice && matchesSearch;
  });
  $('[data-statute-list]').innerHTML = filtered.length
    ? renderStatuteGroups(filtered)
    : '<article class="bookmark-empty">No statute references match this jurisdiction, practice area, or search term.</article>';
}

function renderStatuteGroups(items) {
  return jurisdictions
    .filter((jurisdiction) => state.statuteJurisdiction === 'all' || jurisdiction.id === state.statuteJurisdiction)
    .map((jurisdiction) => {
      const jurisdictionItems = items.filter((item) => item.jurisdiction === jurisdiction.id);
      if (!jurisdictionItems.length) return '';
      const areaMarkup = practiceAreas
        .map((area) => {
          const areaItems = jurisdictionItems.filter((item) => item.area === area);
          if (!areaItems.length) return '';
          return `
            <section class="statute-area">
              <div class="statute-area-heading">
                <strong>${escapeHtml(area)}</strong>
                <span>${areaItems.length} section${areaItems.length === 1 ? '' : 's'}</span>
              </div>
              <div class="statute-grid">
                ${areaItems.map(renderStatuteCard).join('')}
              </div>
            </section>
          `;
        })
        .join('');
      return `
        <section class="jurisdiction-law-block">
          <div class="law-block-heading">
            <div>
              <span class="pill">${escapeHtml(jurisdiction.shortName)}</span>
              <h3>${escapeHtml(jurisdiction.name)} law only</h3>
            </div>
            <p>${jurisdictionItems.length} statute/rule reference${jurisdictionItems.length === 1 ? '' : 's'} in ${escapeHtml(jurisdiction.citationStyle)}</p>
          </div>
          ${areaMarkup}
        </section>
      `;
    })
    .join('');
}

function renderStatuteCard(item) {
  const bookmarked = isBookmarked(item.id);
  return `
    <article class="statute-card">
      <span class="pill">${escapeHtml(getJurisdictionName(item.jurisdiction))}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <strong>${escapeHtml(item.section)}</strong>
      <p>${escapeHtml(item.note)}</p>
      <div class="case-actions">
        <button type="button" data-action="bookmark" data-id="${item.id}">${bookmarked ? 'Saved' : 'Bookmark'}</button>
        <button type="button" data-action="copy-statute" data-id="${item.id}">Copy section</button>
        <a class="compact-action" href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `;
}

function runResearch() {
  const questionInput = $('[data-research-question]');
  const question = questionInput.value.trim();
  if (!question) {
    showToast('Write a legal question first');
    questionInput.focus();
    return;
  }

  const jurisdiction = $('[data-research-jurisdiction]').value;
  const practice = $('[data-research-practice]').value;
  const mode = $('[data-research-mode]').value;
  const result = buildResearchResult(question, jurisdiction, practice, mode);
  state.lastAnswerText = result.text;
  $('[data-research-answer]').innerHTML = result.html;
}

function buildResearchResult(question, jurisdiction, practice, mode) {
  const tokens = tokenize(question);
  if (jurisdiction === 'all' || mode === 'compare') {
    return buildJurisdictionWiseAnswer(question, practice, mode, tokens);
  }
  const pool = cases.filter((item) => {
    const matchesJurisdiction = item.jurisdiction === jurisdiction;
    const matchesPractice = practice === 'all' || item.practiceArea === practice;
    return matchesJurisdiction && matchesPractice;
  });
  const statutePool = statutes.filter((item) => {
    const matchesJurisdiction = item.jurisdiction === jurisdiction;
    const matchesPractice = practice === 'all' || item.area === practice;
    return matchesJurisdiction && matchesPractice;
  });

  const caseLimit = mode === 'short' ? 3 : 6;
  const statuteLimit = mode === 'short' ? 4 : 8;
  const rankedCases = rankItems(pool, tokens).slice(0, caseLimit);
  const rankedStatutes = rankItems(statutePool, tokens).slice(0, statuteLimit);
  const confidence = rankedCases.length >= 2 || rankedStatutes.length >= 2 ? 'Source match found' : 'Needs more legal context';

  if (!rankedCases.length && !rankedStatutes.length) {
    return buildNoMatchAnswer(question, jurisdiction, practice);
  }

  const caseLines = rankedCases
    .map((item, index) => `${index + 1}. ${item.title} (${item.citation}) - ${item.principle}`)
    .join('\n');
  const statuteLines = rankedStatutes.map((item, index) => `${index + 1}. ${item.title}: ${item.section}`).join('\n');

  const summary = rankedCases.length
    ? `The strongest starting point is ${rankedCases[0].title}, because it addresses ${rankedCases[0].issue.toLowerCase()}`
    : `The closest source match is ${rankedStatutes[0].title}: ${rankedStatutes[0].section}.`;
  const jurisdictionName = getJurisdictionName(jurisdiction);

  const text = [
    `Question: ${question}`,
    `Jurisdiction: ${jurisdictionName}`,
    `Practice area: ${practice === 'all' ? 'All practice areas' : practice}`,
    '',
    `Preliminary answer: ${summary}. Treat this as research assistance only; verify the full text and current law before use.`,
    '',
    'Authorities:',
    caseLines || 'No matching cases found.',
    '',
    'Statute / rule references:',
    statuteLines || 'No matching statute references found.',
    '',
    'Lawyer next steps:',
    '- Verify source links and current amendments.',
    '- Check limitation, forum, evidence, and local procedural rules.',
    '- Save relevant authorities to the matter file before drafting.',
  ].join('\n');

  const html = `
    <div class="answer-scope">
      <span class="pill">Jurisdiction locked: ${escapeHtml(jurisdictionName)}</span>
      <span class="pill">${escapeHtml(practice === 'all' ? 'All practice areas' : practice)}</span>
    </div>
    <h3>Preliminary answer</h3>
    <p>${escapeHtml(summary)}. This is a source-grounded demo output and must be checked by a qualified lawyer.</p>
    <h3>Case references</h3>
    ${rankedCases.length ? `<ol>${rankedCases.map(renderAnswerCase).join('')}</ol>` : '<p class="muted">No matching cases found.</p>'}
    <h3>Dhara / statute references</h3>
    ${rankedStatutes.length ? `<ol>${rankedStatutes.map(renderAnswerStatute).join('')}</ol>` : '<p class="muted">No matching statute references found.</p>'}
    <h3>Lawyer notes</h3>
    <ul class="clean-list">
      <li>Use the citations as a research trail, not as final advice.</li>
      <li>Check limitation, procedural forum, evidence, and local court practice.</li>
      <li>Attach the relevant authorities to a chamber matter before drafting.</li>
    </ul>
    <p><span class="pill">${confidence}</span></p>
  `;

  return { html, text };
}

function buildJurisdictionWiseAnswer(question, practice, mode, tokens) {
  const caseLimit = mode === 'short' ? 2 : 4;
  const statuteLimit = mode === 'short' ? 3 : 6;
  const grouped = jurisdictions.map((jurisdiction) => {
    const localCases = rankItems(
      cases.filter((item) => item.jurisdiction === jurisdiction.id && (practice === 'all' || item.practiceArea === practice)),
      tokens,
    ).slice(0, caseLimit);
    const localStatutes = rankItems(
      statutes.filter((item) => item.jurisdiction === jurisdiction.id && (practice === 'all' || item.area === practice)),
      tokens,
    ).slice(0, statuteLimit);
    return { jurisdiction, localCases, localStatutes };
  });
  const hasAnyMatch = grouped.some((group) => group.localCases.length || group.localStatutes.length);
  if (!hasAnyMatch) return buildNoMatchAnswer(question, 'all', practice);

  const text = [
    `Question: ${question}`,
    'Jurisdiction: All jurisdictions, grouped separately',
    `Practice area: ${practice === 'all' ? 'All practice areas' : practice}`,
    '',
    ...grouped.flatMap(({ jurisdiction, localCases, localStatutes }) => [
      `${jurisdiction.name}:`,
      `Cases: ${localCases.map((item) => `${item.title} (${item.citation})`).join('; ') || 'No matching case in this jurisdiction.'}`,
      `Sections/rules: ${localStatutes.map((item) => `${item.title} - ${item.section}`).join('; ') || 'No matching statute/rule in this jurisdiction.'}`,
      '',
    ]),
    'Professional caution: do not mix authorities across jurisdictions without checking court hierarchy and local procedure.',
  ].join('\n');

  const html = `
    <div class="answer-scope">
      <span class="pill">Grouped by jurisdiction</span>
      <span class="pill">${escapeHtml(practice === 'all' ? 'All practice areas' : practice)}</span>
    </div>
    <h3>Jurisdiction-wise answer</h3>
    <p>Results are separated by legal system so Bangladesh dhara, England & Wales sections, and US provisions do not get mixed.</p>
    <div class="answer-jurisdiction-list">
      ${grouped
        .map(
          ({ jurisdiction, localCases, localStatutes }) => `
            <section class="answer-jurisdiction">
              <div class="law-block-heading">
                <div>
                  <span class="pill">${escapeHtml(jurisdiction.shortName)}</span>
                  <h3>${escapeHtml(jurisdiction.name)}</h3>
                </div>
                <p>${escapeHtml(jurisdiction.citationStyle)}</p>
              </div>
              <h4>Matched cases</h4>
              ${
                localCases.length
                  ? `<ol>${localCases.map(renderAnswerCase).join('')}</ol>`
                  : '<p class="muted">No matching case in this jurisdiction.</p>'
              }
              <h4>Matched dhara / sections / rules</h4>
              ${
                localStatutes.length
                  ? `<ol>${localStatutes.map(renderAnswerStatute).join('')}</ol>`
                  : '<p class="muted">No matching statute/rule in this jurisdiction.</p>'
              }
            </section>
          `,
        )
        .join('')}
    </div>
  `;

  return { html, text };
}

function buildNoMatchAnswer(question, jurisdiction, practice) {
  const jurisdictionName = jurisdiction === 'all' ? 'the selected jurisdictions' : getJurisdictionName(jurisdiction);
  const practiceName = practice === 'all' ? 'all practice areas' : practice;
  const text = [
    `Question: ${question}`,
    '',
    'No source-grounded legal answer generated.',
    `The query did not match the current demo library for ${jurisdictionName} / ${practiceName}.`,
    '',
    'Try adding a legal topic, statute number, case name, court, or factual context.',
    'Examples:',
    '- What is Penal Code section 420 in Bangladesh?',
    '- Find authorities for fatal road accident compensation.',
    '- Compare unlawful arrest safeguards across jurisdictions.',
  ].join('\n');

  const html = `
    <h3>No source-grounded answer generated</h3>
    <p>The query did not match the current demo library for <strong>${escapeHtml(jurisdictionName)}</strong> / <strong>${escapeHtml(practiceName)}</strong>.</p>
    <p>This app should not invent legal answers when it cannot find a matching source.</p>
    <h3>Try a more legal query</h3>
    <ul class="clean-list">
      <li>What is Penal Code section 420 in Bangladesh?</li>
      <li>Find authorities for fatal road accident compensation.</li>
      <li>Compare unlawful arrest safeguards across jurisdictions.</li>
    </ul>
    <p><span class="pill">Needs more legal context</span></p>
  `;

  return { html, text };
}

function renderAnswerCase(item) {
  return `
    <li>
      <strong>${escapeHtml(item.title)}</strong>, ${escapeHtml(item.citation)}
      <br>${escapeHtml(item.principle)}
      <br><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceLabel)}</a>
    </li>
  `;
}

function renderAnswerStatute(item) {
  return `
    <li>
      <strong>${escapeHtml(item.title)}</strong> - ${escapeHtml(item.section)}
      <br>${escapeHtml(item.note)}
      <br><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
    </li>
  `;
}

function fillSampleQuestion() {
  const samples = [
    'What cases and statute sections should I cite for a fatal road accident compensation claim?',
    'How do Bangladesh, England & Wales, and the United States approach unlawful arrest or police power?',
    'Find land and property authorities for eviction, public land, or development over protected land.',
    'Prepare authorities for a contract dispute involving penalty clauses or expectation damages.',
  ];
  $('[data-research-question]').value = samples[Math.floor(Math.random() * samples.length)];
}

function generateDraft() {
  const template = draftTemplates.find((item) => item.id === $('[data-draft-template]').value) || draftTemplates[0];
  const jurisdiction = $('[data-draft-jurisdiction]').value;
  const client = $('[data-draft-client]').value.trim() || '[Client Name]';
  const opponent = $('[data-draft-opponent]').value.trim() || '[Opposing Party]';
  const facts = $('[data-draft-facts]').value.trim() || '[Insert verified facts, dates, documents, injuries, losses, and relief sought.]';
  const relevantCases = rankItems(cases.filter((item) => item.jurisdiction === jurisdiction), tokenize(facts)).slice(0, 3);
  const relevantStatutes = rankItems(statutes.filter((item) => item.jurisdiction === jurisdiction), tokenize(facts)).slice(0, 4);
  const jurisdictionName = getJurisdictionName(jurisdiction);

  const draft = `${template.heading}

Jurisdiction: ${jurisdictionName}
Client / Matter: ${client}
Opposing Party: ${opponent}
Purpose: ${template.purpose}

1. Background
${facts}

2. Issues for Counsel
- What legal duties, procedural rules, and limitation issues apply?
- Which remedies should be sought immediately?
- What evidence must be collected before filing or service?

3. Draft Legal Position
Based on the verified facts presently available, ${client} may rely on the following legal framework in ${jurisdictionName}. The final pleading or notice should be settled by a qualified lawyer after checking primary sources and local procedural rules.

4. Authorities to Verify
${relevantCases.map((item, index) => `${index + 1}. ${item.title}, ${item.citation} - ${item.principle}`).join('\n') || '1. [Add authority after legal research]'}

5. Statute / Dhara / Rule References
${relevantStatutes.map((item, index) => `${index + 1}. ${item.title} - ${item.section}`).join('\n') || '1. [Add statute section after legal research]'}

6. Relief / Next Action
- Preserve documents and witness details.
- Calculate limitation and filing deadlines.
- Prepare evidence bundle and authority list.
- Seek settlement, interim relief, bail, compensation, injunction, or declaratory relief as appropriate.

Professional disclaimer: This is a supervised drafting aid. It is not legal advice and must be reviewed against current law before use.`;

  $('[data-draft-output]').textContent = draft;
  showToast('Draft generated');
}

function renderDraftPlaceholder() {
  $('[data-draft-output]').textContent = 'Choose a template and add facts to generate a structured lawyer-reviewed draft.';
}

function saveDraft() {
  const body = $('[data-draft-output]').textContent.trim();
  if (!body || body.startsWith('Choose a template')) {
    showToast('Generate a draft first');
    return;
  }
  const drafts = readStore(storageKeys.drafts);
  drafts.unshift({ id: createId(), body, createdAt: new Date().toISOString() });
  writeStore(storageKeys.drafts, drafts);
  showToast('Draft saved locally');
}

function renderMatters() {
  const matters = readStore(storageKeys.matters);
  $('[data-matter-list]').innerHTML = matters.length
    ? matters.map(renderMatterCard).join('')
    : '<p class="muted">No matters yet. Add one to start chamber tracking.</p>';
  renderDashboard();
}

function renderMatterCard(item) {
  return `
    <article class="matter-card">
      <div class="case-meta">
        <span>${escapeHtml(item.jurisdictionName)}</span>
        <span>${escapeHtml(item.practiceArea)}</span>
        <span>${escapeHtml(item.feeStatus)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="muted">${escapeHtml(item.client)} - ${escapeHtml(item.court || 'Court/forum pending')}</p>
      <div class="case-actions">
        <button type="button" data-route="drafting">Draft</button>
        <button type="button" data-route="reminders">Reminder</button>
        <button class="danger-button" type="button" data-action="delete-matter" data-id="${item.id}">Delete</button>
      </div>
    </article>
  `;
}

function addMatter() {
  const client = $('[data-matter-client]').value.trim();
  const title = $('[data-matter-title]').value.trim();
  if (!client || !title) {
    showToast('Client and matter title are required');
    return;
  }
  const jurisdiction = $('[data-matter-jurisdiction]').value;
  const matter = {
    id: createId(),
    client,
    title,
    jurisdiction,
    jurisdictionName: getJurisdictionName(jurisdiction),
    practiceArea: $('[data-matter-practice]').value,
    court: $('[data-matter-court]').value.trim(),
    feeStatus: $('[data-matter-fee]').value,
    createdAt: new Date().toISOString(),
  };
  const matters = readStore(storageKeys.matters);
  matters.unshift(matter);
  writeStore(storageKeys.matters, matters);
  clearInputs(['[data-matter-client]', '[data-matter-title]', '[data-matter-court]']);
  renderMatters();
  showToast('Matter added');
}

function renderNotes() {
  const notes = readStore(storageKeys.notes);
  $('[data-note-list]').innerHTML = notes.length
    ? notes.map(renderNoteCard).join('')
    : '<p class="muted">No notes yet. Save research outputs or add private strategy notes.</p>';
}

function renderNoteCard(item) {
  return `
    <article class="note-card">
      <div class="case-meta">
        <span>${new Date(item.createdAt).toLocaleString()}</span>
        <span>${escapeHtml(item.tag || 'general')}</span>
      </div>
      <h3>${escapeHtml(item.title || 'Lawyer note')}</h3>
      <p>${escapeHtml(item.body)}</p>
      <button class="danger-button" type="button" data-action="delete-note" data-id="${item.id}">Delete</button>
    </article>
  `;
}

function addNote() {
  const body = $('[data-note-body]').value.trim();
  if (!body) {
    showToast('Write a note first');
    return;
  }
  addNoteObject({
    title: 'Private chamber note',
    tag: $('[data-note-tag]').value.trim() || 'general',
    body,
  });
  clearInputs(['[data-note-body]', '[data-note-tag]']);
  showToast('Note added');
}

function saveAnswerAsNote() {
  if (!state.lastAnswerText) {
    showToast('Generate an answer first');
    return;
  }
  addNoteObject({ title: 'Saved AI research answer', tag: 'research', body: state.lastAnswerText });
  showToast('Research answer saved to notes');
}

function createCaseNote(id) {
  const item = cases.find((caseItem) => caseItem.id === id);
  if (!item) return;
  addNoteObject({
    title: `Case note: ${item.title}`,
    tag: item.practiceArea,
    body: `${item.title}, ${item.citation}\n\nIssue: ${item.issue}\nPrinciple: ${item.principle}\nLawyer note: ${item.lawyerNote}`,
  });
  showToast('Case note created');
}

function addNoteObject(note) {
  const notes = readStore(storageKeys.notes);
  notes.unshift({ id: createId(), createdAt: new Date().toISOString(), ...note });
  writeStore(storageKeys.notes, notes);
  renderNotes();
}

function renderReminders() {
  const reminders = readStore(storageKeys.reminders).sort((a, b) => a.date.localeCompare(b.date));
  $('[data-reminder-list]').innerHTML = reminders.length
    ? reminders.map(renderReminderCard).join('')
    : '<p class="muted">No hearing dates or deadlines yet.</p>';
  renderDashboard();
}

function renderReminderCard(item) {
  const due = getDueLabel(item.date);
  return `
    <article class="reminder-card">
      <div class="case-meta">
        <span>${escapeHtml(item.type)}</span>
        <span>${escapeHtml(due)}</span>
        <span>${item.done ? 'Done' : 'Open'}</span>
      </div>
      <h3>${escapeHtml(item.matter)}</h3>
      <p class="muted">${escapeHtml(item.court || 'Court/forum pending')} - ${escapeHtml(formatDate(item.date))}</p>
      <div class="case-actions">
        <button type="button" data-action="toggle-reminder" data-id="${item.id}">${item.done ? 'Reopen' : 'Mark done'}</button>
        <button class="danger-button" type="button" data-action="delete-reminder" data-id="${item.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderReminderCompact(item) {
  return `
    <article class="reminder-card">
      <strong>${escapeHtml(item.matter)}</strong>
      <span class="muted">${escapeHtml(item.type)} - ${escapeHtml(formatDate(item.date))} - ${escapeHtml(item.court || 'Court pending')}</span>
    </article>
  `;
}

function addReminder() {
  const matter = $('[data-reminder-matter]').value.trim();
  const date = $('[data-reminder-date]').value;
  if (!matter || !date) {
    showToast('Matter and date are required');
    return;
  }
  const reminders = readStore(storageKeys.reminders);
  reminders.unshift({
    id: createId(),
    matter,
    court: $('[data-reminder-court]').value.trim(),
    date,
    type: $('[data-reminder-type]').value,
    done: false,
    createdAt: new Date().toISOString(),
  });
  writeStore(storageKeys.reminders, reminders);
  clearInputs(['[data-reminder-matter]', '[data-reminder-court]']);
  renderReminders();
  showToast('Reminder added');
}

function toggleReminder(id) {
  const reminders = readStore(storageKeys.reminders).map((item) => (item.id === id ? { ...item, done: !item.done } : item));
  writeStore(storageKeys.reminders, reminders);
  renderReminders();
}

function renderBookmarks() {
  const bookmarks = readStore(storageKeys.bookmarks);
  const items = bookmarks.map(getAuthorityById).filter(Boolean);
  $('[data-bookmark-list]').innerHTML = items.length
    ? items.map((item) => (item.citation ? renderCaseCard(item) : renderStatuteCard(item))).join('')
    : '<article class="bookmark-empty">No saved authorities yet. Bookmark cases or statutes from the library.</article>';
  renderDashboard();
}

function renderCitationPicker() {
  const bookmarked = new Set(readStore(storageKeys.bookmarks));
  const topCases = [...cases].sort((a, b) => Number(bookmarked.has(b.id)) - Number(bookmarked.has(a.id)));
  $('[data-citation-picker]').innerHTML = topCases
    .map(
      (item, index) => `
        <label class="citation-option">
          <input type="checkbox" value="${item.id}" ${index < 5 || bookmarked.has(item.id) ? 'checked' : ''} />
          <span>
            ${escapeHtml(item.title)}
            <br><span class="muted">${escapeHtml(item.citation)} - ${escapeHtml(getJurisdictionName(item.jurisdiction))}</span>
          </span>
        </label>
      `,
    )
    .join('');
}

function buildCitations() {
  const format = $('[data-citation-format]').value;
  const selected = $$('[data-citation-picker] input:checked')
    .map((input) => cases.find((item) => item.id === input.value))
    .filter(Boolean);
  if (!selected.length) {
    showToast('Select at least one case');
    return;
  }
  state.lastCitationText = selected.map((item, index) => `${index + 1}. ${formatCitation(item, format)}`).join('\n');
  $('[data-citation-output]').textContent = state.lastCitationText;
  showToast('Citation list built');
}

function formatCitation(item, format) {
  if (format === 'oscola') return `${item.title} ${item.citation} (${item.court}) <${item.sourceUrl}>`;
  if (format === 'bluebook') return `${item.title}, ${item.citation} (${item.court} ${item.year}), ${item.sourceUrl}.`;
  if (format === 'bangladesh') return `${item.title}; ${item.citation}; ${item.court}; issue: ${item.issue}; source: ${item.sourceUrl}`;
  return `${item.title}, ${item.citation}, ${item.court} (${item.year}) - ${item.sourceUrl}`;
}

function downloadCitations() {
  if (!state.lastCitationText) buildCitations();
  if (!state.lastCitationText) return;
  const blob = new Blob([state.lastCitationText], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lexbridge-citations.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

function toggleBookmark(id) {
  const bookmarks = readStore(storageKeys.bookmarks);
  const next = bookmarks.includes(id) ? bookmarks.filter((item) => item !== id) : [id, ...bookmarks];
  writeStore(storageKeys.bookmarks, next);
  renderCases();
  renderStatutes();
  renderBookmarks();
  renderCitationPicker();
  showToast(next.includes(id) ? 'Authority bookmarked' : 'Bookmark removed');
}

function isBookmarked(id) {
  return readStore(storageKeys.bookmarks).includes(id);
}

function copyCitation(id) {
  const item = cases.find((caseItem) => caseItem.id === id);
  if (!item) return;
  copyText(formatCitation(item, 'neutral'), 'Citation copied');
}

function copyStatute(id) {
  const item = statutes.find((statute) => statute.id === id);
  if (!item) return;
  copyText(`${item.title} - ${item.section}\n${item.note}\n${item.sourceUrl}`, 'Section copied');
}

function attachCaseToMatter(id) {
  const item = cases.find((caseItem) => caseItem.id === id);
  if (!item) return;
  const matters = readStore(storageKeys.matters);
  const targetMatter = matters[0] || {
    id: createId(),
    client: 'Demo Client',
    title: 'Research authorities',
    jurisdiction: item.jurisdiction,
    jurisdictionName: getJurisdictionName(item.jurisdiction),
    practiceArea: item.practiceArea,
    court: 'Pending',
    feeStatus: 'Consultation pending',
    createdAt: new Date().toISOString(),
  };
  if (!matters.length) {
    matters.unshift(targetMatter);
    writeStore(storageKeys.matters, matters);
    renderMatters();
  }
  addNoteObject({
    title: `Authority attached to ${targetMatter.title}`,
    tag: 'matter authority',
    body: `${item.title}, ${item.citation}\n${item.principle}\nSource: ${item.sourceUrl}`,
  });
  showToast('Case attached to matter note');
}

function deleteItem(key, id, renderFn, message) {
  writeStore(
    key,
    readStore(key).filter((item) => item.id !== id),
  );
  renderFn();
  showToast(message);
}

function seedDemoData() {
  if (!localStorage.getItem(storageKeys.matters)) {
    writeStore(storageKeys.matters, [
      {
        id: createId(),
        client: 'Rahman Family',
        title: 'Fatal road accident compensation',
        jurisdiction: 'bangladesh',
        jurisdictionName: 'Bangladesh',
        practiceArea: 'Road Accident / Personal Injury',
        court: 'High Court Division',
        feeStatus: 'Retainer received',
        createdAt: new Date().toISOString(),
      },
      {
        id: createId(),
        client: 'Northstar Trading Ltd',
        title: 'Commercial penalty clause review',
        jurisdiction: 'england-wales',
        jurisdictionName: 'England & Wales',
        practiceArea: 'Contract / Commercial',
        court: 'Pre-action',
        feeStatus: 'Invoice sent',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
  if (!localStorage.getItem(storageKeys.reminders)) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    writeStore(storageKeys.reminders, [
      { id: createId(), matter: 'Fatal road accident compensation', court: 'High Court Division', date: tomorrow, type: 'Hearing', done: false, createdAt: new Date().toISOString() },
      { id: createId(), matter: 'Commercial penalty clause review', court: 'Pre-action', date: nextWeek, type: 'Filing deadline', done: false, createdAt: new Date().toISOString() },
    ]);
  }
  if (!localStorage.getItem(storageKeys.notes)) {
    writeStore(storageKeys.notes, [
      {
        id: createId(),
        title: 'Demo strategy note',
        tag: 'client intake',
        body: 'Check limitation, collect police report, medical evidence, dependency documents, and insurance/vehicle ownership records before drafting.',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

function setupDisclaimer() {
  if (!localStorage.getItem(storageKeys.disclaimer)) {
    setTimeout(openDisclaimer, 450);
  }
}

function openDisclaimer() {
  $('[data-disclaimer-modal]')?.showModal();
}

function closeDisclaimer() {
  $('[data-disclaimer-modal]')?.close();
}

function acceptDisclaimer() {
  localStorage.setItem(storageKeys.disclaimer, 'true');
  closeDisclaimer();
  showToast('Disclaimer accepted for this demo browser');
}

function setupPwa() {
  if (!('serviceWorker' in navigator)) return;

  const isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if (isLocalDev) {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      registrations
        .filter((registration) => registration.scope.includes('/legal-ai-app/'))
        .forEach((registration) => registration.unregister());
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.filter((key) => key.startsWith('lexbridge-counsel')).forEach((key) => caches.delete(key));
      });
    }
    return;
  }

  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

function rankItems(items, tokens) {
  const scored = items.map((item) => {
    const haystack = normalize(Object.values(item).flat().join(' '));
    const score = tokens.reduce((total, token) => {
      const exactSection = /^\d+[a-z]?$/.test(token) && new RegExp(`(^|\\D)${escapeRegex(token)}($|\\D)`).test(haystack);
      return total + (haystack.includes(token) ? 1 : 0) + (exactSection ? 3 : 0);
    }, 0);
    return { item, score };
  });
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.year) - Number(a.item.year))
    .map(({ item }) => item);
}

function tokenize(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 28);
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9§\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getAuthorityById(id) {
  return cases.find((item) => item.id === id) || statutes.find((item) => item.id === id);
}

function getJurisdictionName(id) {
  return jurisdictions.find((item) => item.id === id)?.name || id;
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clearInputs(selectors) {
  selectors.forEach((selector) => {
    const input = $(selector);
    if (input) input.value = '';
  });
}

async function copyText(text, message) {
  if (!text) {
    showToast('Nothing to copy yet');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast(message);
}

function showToast(message) {
  const toast = $('[data-toast]');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function getDueLabel(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  const diff = Math.round((date - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

init();

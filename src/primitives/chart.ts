/**
 * chart primitive — Chart.js opt-in data visualisation.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, spaceToken, resolveString, getArrayItems,
} from '../renderer/helpers.js';
import type { ResolvedTokens } from '../tokens/types.js';

// Fallback palette for when token values aren't available
const FALLBACK_COLORS = [
  '#4f8ef7',
  'rgba(99,102,241,0.8)',
  'rgba(16,185,129,0.8)',
  'rgba(245,158,11,0.8)',
  'rgba(239,68,68,0.8)',
];

/** Resolve a color name to a concrete CSS color value (no CSS vars — canvas can't use them). */
function resolveColor(color: string, tokens: ResolvedTokens): string {
  if (color === 'accent') return tokens.values['--t-accent-default'] ?? FALLBACK_COLORS[0];
  if (color === 'secondary') return tokens.values['--t-text-secondary'] ?? FALLBACK_COLORS[1];
  if (color === 'primary') return tokens.values['--t-text-primary'] ?? FALLBACK_COLORS[2];
  // CSS var reference — try to resolve it
  if (color.startsWith('var(--t-')) {
    const key = color.slice(4, -1); // strip 'var(' and ')'
    return tokens.values[key] ?? FALLBACK_COLORS[0];
  }
  return color;
}

function getDefaultColors(tokens: ResolvedTokens): string[] {
  return [
    tokens.values['--t-accent-default'] ?? FALLBACK_COLORS[0],
    tokens.values['--t-accent-shade'] ?? FALLBACK_COLORS[1],
    'rgba(16,185,129,0.85)',
    'rgba(245,158,11,0.85)',
    'rgba(239,68,68,0.85)',
  ];
}


export function renderChart(ctx: RenderContext): string {
  const { section, tokens } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;
  const sectionId = esc(section.id);
  const defaultColors = getDefaultColors(tokens);

  const padSize = getModArg(modifiers, 'pad', 'section');
  const bgToken = getModArg(modifiers, 'bg', '');
  const chartType = getModArg(modifiers, 'type', 'bar');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceDefault;

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  const titleStyle = style({
    'font-family': T.familySerif,
    'font-size': T.scaleH3,
    'font-weight': T.weightHeading,
    'color': T.textPrimary,
    'margin': `0 0 ${T.spaceMd} 0`,
    'text-align': 'center',
  });

  const title = resolveString(properties['title']);

  // Determine datasets
  let datasetsJs = '';
  const isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';

  const datasetsVal = properties['datasets'];
  const dataVal = properties['data'];

  if (datasetsVal) {
    // Multi-dataset mode
    const datasetItems = getArrayItems(datasetsVal);
    const datasets: string[] = [];

    datasetItems.forEach((item, i) => {
      if (item.type !== 'blockValue') return;
      const label = resolveString(item.properties['label']) || `Dataset ${i + 1}`;
      const dataStr = resolveString(item.properties['data']);
      const colorStr = resolveString(item.properties['color']);
      const nums = dataStr.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));

      const color = colorStr
        ? resolveColor(colorStr, tokens)
        : defaultColors[i % defaultColors.length];

      if (isPieOrDoughnut) {
        datasets.push(`{
          label: ${JSON.stringify(label)},
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(defaultColors)},
          borderWidth: 2
        }`);
      } else {
        // Make background slightly transparent
        const bgColor = color.startsWith('#')
          ? color + 'aa'  // hex + alpha
          : color.replace(/,\s*[\d.]+\)$/, ', 0.6)').replace(/^(rgb\()/, 'rgba(');
        datasets.push(`{
          label: ${JSON.stringify(label)},
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(bgColor)},
          borderColor: ${JSON.stringify(color)},
          borderWidth: 2${chartType === 'line' ? ',\n          tension: 0.3,\n          fill: false' : ''}
        }`);
      }
    });

    datasetsJs = `[${datasets.join(',\n        ')}]`;
  } else if (dataVal) {
    // Single-dataset shorthand
    const dataStr = resolveString(dataVal);
    const nums = dataStr.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    const color = defaultColors[0];
    const bgColor = color.startsWith('#') ? color + 'aa' : color.replace(/,\s*[\d.]+\)$/, ', 0.6)').replace(/^(rgb\()/, 'rgba(');

    if (isPieOrDoughnut) {
      datasetsJs = `[{
          label: '',
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(defaultColors)},
          borderWidth: 2
        }]`;
    } else {
      datasetsJs = `[{
          label: '',
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(bgColor)},
          borderColor: ${JSON.stringify(color)},
          borderWidth: 2${chartType === 'line' ? ',\n          tension: 0.3,\n          fill: false' : ''}
        }]`;
    }
  } else {
    datasetsJs = '[]';
  }

  // Compute labels
  const labelsVal = properties['labels'];
  const labelsStr = resolveString(labelsVal);
  const labelsArr = labelsStr
    ? labelsStr.split(',').map((s) => s.trim())
    : [];
  const labelsJs = JSON.stringify(labelsArr);

  // Count datasets for legend visibility
  const datasetsVal2 = properties['datasets'];
  const datasetCount = datasetsVal2 ? getArrayItems(datasetsVal2).length : 1;
  const showLegend = datasetCount > 1;

  // Resolve text/grid colors from tokens (canvas can't read CSS vars)
  const textColor = tokens.values['--t-text-secondary'] ?? '#666666';
  const gridColor = tokens.values['--t-border-subtle'] ?? 'rgba(0,0,0,0.1)';

  return `<section class="tela-chart" style="${sectionStyle}">
  <div style="max-width: 800px; margin: 0 auto;">
    ${title ? `<h3 style="${titleStyle}">${esc(title)}</h3>` : ''}
    <div style="position: relative; height: 360px;">
      <canvas id="tela-chart-${sectionId}"></canvas>
    </div>
  </div>
</section>
<!-- __TELA_CHARTJS__ -->
<script>
(function() {
  var ctx = document.getElementById('tela-chart-${sectionId}');
  if (!ctx) return;
  new Chart(ctx, {
    type: ${JSON.stringify(chartType)},
    data: {
      labels: ${labelsJs},
      datasets: ${datasetsJs}
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: ${showLegend},
          labels: { color: ${JSON.stringify(textColor)} }
        },
        title: { display: false }
      },
      scales: ${chartType === 'pie' || chartType === 'doughnut' ? '{}' : `{
        x: { ticks: { color: ${JSON.stringify(textColor)} }, grid: { color: ${JSON.stringify(gridColor)} } },
        y: { ticks: { color: ${JSON.stringify(textColor)} }, grid: { color: ${JSON.stringify(gridColor)} } }
      }`}
    }
  });
})();
</script>`;
}

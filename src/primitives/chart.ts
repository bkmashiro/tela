/**
 * chart primitive — Chart.js opt-in data visualisation.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, spaceToken, resolveString, getArrayItems,
} from '../renderer/helpers.js';

const DEFAULT_COLORS = [
  'var(--t-accent-default)',
  'rgba(99,102,241,0.8)',
  'rgba(16,185,129,0.8)',
  'rgba(245,158,11,0.8)',
  'rgba(239,68,68,0.8)',
];

function resolveColor(color: string): string {
  if (color === 'accent') return 'var(--t-accent-default)';
  if (color === 'secondary') return 'var(--t-text-secondary)';
  return color;
}

function toColorBg(color: string): string {
  const c = resolveColor(color);
  // If it's already a CSS var or rgba, use as-is
  if (c.startsWith('var(') || c.startsWith('rgba(')) return c;
  // For hex or rgb, add some opacity for background
  return c;
}

export function renderChart(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;
  const sectionId = esc(section.id);

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
        ? resolveColor(colorStr)
        : DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      if (isPieOrDoughnut) {
        const bgColors = JSON.stringify(DEFAULT_COLORS);
        datasets.push(`{
          label: ${JSON.stringify(label)},
          data: ${JSON.stringify(nums)},
          backgroundColor: ${bgColors},
          borderWidth: 2
        }`);
      } else {
        datasets.push(`{
          label: ${JSON.stringify(label)},
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(color.replace(/rgba\((\d+,\d+,\d+),[\d.]+\)/, 'rgba($1,0.6)') || color)},
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
    const color = DEFAULT_COLORS[0];

    if (isPieOrDoughnut) {
      datasetsJs = `[{
          label: '',
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(DEFAULT_COLORS)},
          borderWidth: 2
        }]`;
    } else {
      datasetsJs = `[{
          label: '',
          data: ${JSON.stringify(nums)},
          backgroundColor: ${JSON.stringify(color.replace(/rgba\((\d+,\d+,\d+),[\d.]+\)/, 'rgba($1,0.6)') || color)},
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

  return `<section class="tela-chart" style="${sectionStyle}">
  <div style="max-width: 800px; margin: 0 auto;">
    ${title ? `<h3 style="${titleStyle}">${esc(title)}</h3>` : ''}
    <div style="position: relative; height: 360px;">
      <canvas id="tela-chart-${sectionId}"></canvas>
    </div>
  </div>
</section>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
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
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: ${showLegend} },
        title: { display: false }
      }
    }
  });
})();
</script>`;
}

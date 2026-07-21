(function () {
  let repoId = null;
  let repoData = null;
  let fileTreeData = [];

  var refreshTimer = null;
  var refreshAttempts = 0;
  var maxRefreshAttempts = 30;

  var currentTab = null;
  var simulationRunning = false;
  var graphMouseMoveHandler = null;
  var graphMouseUpHandler = null;

  function getEl(id) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('Element not found:', id);
    }
    return el;
  }

  function graphCleanup() {
    simulationRunning = false;
    if (graphMouseMoveHandler) {
      document.removeEventListener('mousemove', graphMouseMoveHandler);
      graphMouseMoveHandler = null;
    }
    if (graphMouseUpHandler) {
      document.removeEventListener('mouseup', graphMouseUpHandler);
      graphMouseUpHandler = null;
    }
  }

  function cleanup() {
    graphCleanup();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    repoId = params.get('id');

    if (!repoId) {
      var repoContent = getEl('repoContent');
      if (repoContent) repoContent.style.display = 'none';
      var repoLoading = getEl('repoLoading');
      if (repoLoading) repoLoading.innerHTML = '<p style="color:var(--error)">No repository ID provided.</p>';
      return;
    }

    loadRepository();

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTab(this.dataset.tab);
      });
    });

    var resyncBtn = getEl('resyncBtn');
    if (resyncBtn) resyncBtn.addEventListener('click', resyncRepo);

    window.addEventListener('beforeunload', cleanup);
  });

  function startAutoRefresh() {
    if (refreshTimer) return;
    if (refreshAttempts >= maxRefreshAttempts) return;
    refreshTimer = setInterval(async function () {
      refreshAttempts++;
      if (refreshAttempts >= maxRefreshAttempts) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        var repoLoading = getEl('repoLoading');
        if (repoLoading) repoLoading.innerHTML = '<p style="color:var(--text-muted)">Repository analysis is taking longer than expected. Please check back later.</p>';
        return;
      }
      try {
        var data = await apiRequest('/repositories/' + repoId);
        var repo = data.data.repository;
        if (repo.analysisStatus === 'completed' || repo.analysisStatus === 'failed') {
          clearInterval(refreshTimer);
          refreshTimer = null;
          loadRepository();
        }
      } catch (e) {}
    }, 3000);
  }

  async function loadRepository() {
    try {
      const data = await apiRequest('/repositories/' + repoId);
      repoData = data.data.repository;

      var nameEl = getEl('repoName');
      if (nameEl) nameEl.textContent = repoData.fullName || repoData.name;

      var descEl = getEl('repoDescription');
      if (descEl) descEl.textContent = repoData.description || 'No description';

      var langEl = getEl('repoLang');
      if (langEl) langEl.textContent = repoData.language || 'Unknown';

      var filesEl = getEl('repoFiles');
      if (filesEl) filesEl.textContent = (repoData.filesCount || 0) + ' files';

      var statusEl = getEl('repoStatus');
      if (statusEl) {
        statusEl.textContent = repoData.analysisStatus;
        statusEl.className = 'badge badge-' + (repoData.analysisStatus === 'completed' ? 'success' : repoData.analysisStatus === 'failed' ? 'error' : 'warning');
      }

      var githubLink = getEl('githubLink');
      if (githubLink && repoData.fullName) {
        githubLink.href = 'https://github.com/' + repoData.fullName;
      }

      var repoLoading = getEl('repoLoading');
      if (repoLoading) repoLoading.style.display = 'none';

      var repoContent = getEl('repoContent');
      if (repoContent) repoContent.style.display = 'block';

      if (repoData.analysisStatus === 'pending' || repoData.analysisStatus === 'analyzing') {
        refreshAttempts = 0;
        startAutoRefresh();
      }

      loadOverview();
      loadFiles();
    } catch (err) {
      var repoLoading = getEl('repoLoading');
      if (repoLoading) repoLoading.innerHTML = '<p style="color:var(--error)">Failed to load repository: ' + err.message + '</p>';
    }
  }

  function loadOverview() {
    var el = getEl('tab-overview');
    if (!el) return;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
        <div class="card"><h3 style="font-size:14px;color:var(--text-muted);margin-bottom:8px">Language</h3><p style="font-size:18px;font-weight:600">${repoData.language || '—'}</p></div>
        <div class="card"><h3 style="font-size:14px;color:var(--text-muted);margin-bottom:8px">Files</h3><p style="font-size:18px;font-weight:600">${repoData.filesCount || 0}</p></div>
        <div class="card"><h3 style="font-size:14px;color:var(--text-muted);margin-bottom:8px">Status</h3><p style="font-size:18px;font-weight:600">${repoData.analysisStatus}</p></div>
        <div class="card"><h3 style="font-size:14px;color:var(--text-muted);margin-bottom:8px">Branch</h3><p style="font-size:18px;font-weight:600">${repoData.defaultBranch || 'main'}</p></div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:8px">Import Date</h3>
        <p style="font-size:15px">${new Date(repoData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    `;
  }

  async function loadFiles() {
    try {
      const data = await apiRequest('/repositories/' + repoId + '/files');
      fileTreeData = data.data.files || [];
      const tree = data.data.tree || [];

      var fileTree = getEl('fileTree');
      if (!fileTree) return;
      var treeHtml = buildTreeHtml(tree);
      fileTree.innerHTML = treeHtml || '<p style="color:var(--text-muted);padding:16px">No files found.</p>';

      fileTree.querySelectorAll('.file-tree-item[data-path]').forEach(function (item) {
        item.addEventListener('click', function () {
          loadFileContent(this.dataset.path);
          fileTree.querySelectorAll('.file-tree-item').forEach(function (el) {
            el.style.background = '';
          });
          this.style.background = 'var(--bg-glass)';
        });
      });
    } catch (err) {
      var fileTree = getEl('fileTree');
      if (fileTree) fileTree.innerHTML = '<p style="color:var(--error);padding:16px">Failed to load files.</p>';
    }
  }

  function buildTreeHtml(tree) {
    if (!tree || tree.length === 0) return '';

    const dirs = {};
    const files = [];

    tree.forEach(function (item) {
      if (item.type === 'tree') {
        const parts = item.path.split('/');
        let current = dirs;
        for (let i = 0; i < parts.length; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
      } else if (item.type === 'blob') {
        files.push(item);
      }
    });

    let html = '<div style="padding:4px 0">';

    const sortedDirs = Object.keys(dirs).sort();
    sortedDirs.forEach(function (dirName) {
      html += '<div class="file-tree-item">';
      html += '<span class="icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></span>';
      html += dirName + '/</div>';
    });

    files.sort(function (a, b) { return a.path.localeCompare(b.path); });
    files.forEach(function (file) {
      html += '<div class="file-tree-item" data-path="' + escapeAttr(file.path) + '">';
      html += '<span class="icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>';
      html += escapeHtml(file.path) + '</div>';
    });

    html += '</div>';
    return html;
  }

  async function loadFileContent(path) {
    var preview = getEl('filePreview');
    if (!preview) return;
    preview.innerHTML = '<div class="file-preview-header">' + escapeHtml(path) + '</div><div class="file-preview-content"><div class="skeleton" style="width:100%;height:20px;margin-bottom:8px"></div><div class="skeleton" style="width:80%;height:20px"></div></div>';

    try {
      const data = await apiRequest('/repositories/' + repoId + '/content?path=' + encodeURIComponent(path));
      const content = data.data.content || '// No content available';
      preview.innerHTML = '<div class="file-preview-header">' + escapeHtml(path) + '</div><div class="file-preview-content">' + escapeHtml(content) + '</div>';
    } catch (err) {
      preview.innerHTML = '<div class="file-preview-header">' + escapeHtml(path) + '</div><div class="file-preview-content" style="color:var(--error)">Failed to load file: ' + escapeHtml(err.message) + '</div>';
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/&/g, '&amp;');
  }

  function switchTab(tab) {
    if (currentTab === 'graph') {
      graphCleanup();
    }

    document.querySelectorAll('.tab-content').forEach(function (el) {
      el.style.display = 'none';
    });
    document.querySelectorAll('.tab').forEach(function (el) {
      el.classList.remove('active');
    });

    var tabContent = getEl('tab-' + tab);
    if (!tabContent) {
      console.warn('Tab content element not found:', tab);
      return;
    }
    tabContent.style.display = 'block';

    var tabButton = document.querySelector('.tab[data-tab="' + tab + '"]');
    if (tabButton) {
      tabButton.classList.add('active');
    }

    currentTab = tab;

    if (tab === 'routes') loadRoutes();
    if (tab === 'dependencies') loadDependencies();
    if (tab === 'graph') loadGraph();
  }

  async function loadRoutes() {
    var el = getEl('tab-routes');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text-muted)">Loading routes...</p>';

    try {
      const data = await apiRequest('/repositories/' + repoId + '/routes');
      const routes = data.data.routes || [];

      if (routes.length === 0) {
        el.innerHTML = '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">No API routes detected.</p></div>';
        return;
      }

      el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
        routes.map(function (r) {
          const methodColors = { GET: 'badge-success', POST: 'badge-primary', PUT: 'badge-warning', PATCH: 'badge-warning', DELETE: 'badge-error' };
          return '<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 16px">' +
            '<span class="badge ' + (methodColors[r.method] || 'badge-primary') + '">' + r.method + '</span>' +
            '<code style="flex:1;font-size:14px;color:var(--text-primary)">' + r.path + '</code>' +
            '<span style="font-size:13px;color:var(--text-muted)">' + (r.file || '') + '</span>' +
            '</div>';
        }).join('') + '</div>';
    } catch (err) {
      el.innerHTML = '<p style="color:var(--error)">Failed to load routes.</p>';
    }
  }

  async function loadDependencies() {
    var el = getEl('tab-dependencies');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text-muted)">Loading dependencies...</p>';

    try {
      const data = await apiRequest('/repositories/' + repoId + '/dependencies');
      const deps = data.data.dependencies || [];

      if (deps.length === 0) {
        el.innerHTML = '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">No dependencies detected.</p></div>';
        return;
      }

      el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
        deps.map(function (d) {
          return '<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 16px">' +
            '<span style="flex:1;font-size:14px;font-weight:500">' + d.name + '</span>' +
            '<span style="font-size:13px;color:var(--text-muted)">' + (d.version || '—') + '</span>' +
            '<span class="badge ' + (d.type === 'production' ? 'badge-primary' : 'badge-warning') + '">' + d.type + '</span>' +
            '</div>';
        }).join('') + '</div>';
    } catch (err) {
      el.innerHTML = '<p style="color:var(--error)">Failed to load dependencies.</p>';
    }
  }

  async function resyncRepo() {
    var btn = getEl('resyncBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Resyncing...';

    try {
      await apiRequest('/repositories/' + repoId + '/resync', { method: 'POST' });
      btn.textContent = 'Resync';
      btn.disabled = false;
      refreshAttempts = 0;
      startAutoRefresh();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Resync';
    }
  }

  async function loadGraph() {
    var container = getEl('graphContainer');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-muted)">Loading graph data...</p>';

    try {
      const data = await apiRequest('/repositories/' + repoId + '/graph');
      var graph = data.data.graph || {};
      const nodes = graph.nodes || [];
      const edges = graph.edges || [];

      if (nodes.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">No architecture graph data available. Import the repository first.</p>';
        return;
      }

      container.innerHTML = '';
      renderGraph(container, nodes, edges);
    } catch (err) {
      container.innerHTML = '<p style="color:var(--error)">Failed to load graph: ' + err.message + '</p>';
    }
  }

  function renderGraph(container, nodes, edges) {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const padding = 60;

    const nodeColors = {
      file: '#4f8cff',
      function: '#22c55e',
      class: '#f59e0b',
      route: '#ef4444',
      model: '#a855f7',
      service: '#ec4899',
    };

    const nodeRanks = { file: 0, function: 1, class: 2, route: 3, model: 4, service: 5 };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('class', 'graph-svg');
    container.appendChild(svg);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '20');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowPath.setAttribute('points', '0 0, 8 3, 0 6');
    arrowPath.setAttribute('fill', 'var(--border)');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    const gEdges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(gEdges);
    const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(gNodes);

    const nodeData = nodes.map(function (n) {
      return {
        id: n._id,
        label: n.name || n.label || n._id,
        type: n.type || 'file',
        x: padding + Math.random() * (width - 2 * padding),
        y: padding + Math.random() * (height - 2 * padding),
        vx: 0,
        vy: 0,
        radius: n.type === 'file' ? 10 : 7,
        data: n,
      };
    });

    const edgeData = edges.map(function (e) {
      return {
        source: typeof e.sourceId === 'object' ? e.sourceId._id || e.sourceId : e.sourceId,
        target: typeof e.targetId === 'object' ? e.targetId._id || e.targetId : e.targetId,
        type: e.type || 'DEPENDS_ON',
        data: e,
      };
    });

    function getNodeIndex(id) {
      for (let i = 0; i < nodeData.length; i++) {
        if (nodeData[i].id === id) return i;
      }
      return -1;
    }

    const nodeMap = {};
    nodeData.forEach(function (n, i) { nodeMap[n.id] = i; });

    const validEdges = edgeData.filter(function (e) {
      return nodeMap[e.source] !== undefined && nodeMap[e.target] !== undefined && e.source !== e.target;
    });

    let simulationTimer = null;
    const simulation = {
      running: true,
      alpha: 1,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
    };
    simulationRunning = true;

    function simulateTick() {
      if (!simulation.running || !simulationRunning) return;

      simulation.alpha += (1 - simulation.alpha) * -simulation.alphaDecay;
      if (simulation.alpha < 0.001) {
        simulation.running = false;
        return;
      }

      for (let i = 0; i < nodeData.length; i++) {
        let fx = 0, fy = 0;

        for (let j = i + 1; j < nodeData.length; j++) {
          const dx = nodeData[j].x - nodeData[i].x;
          const dy = nodeData[j].y - nodeData[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          const force = 600 / (dist * dist) * simulation.alpha;
          fx -= dx / dist * force;
          fy -= dy / dist * force;
        }

        nodeData[i].vx += fx;
        nodeData[i].vy += fy;
      }

      for (let i = 0; i < validEdges.length; i++) {
        const si = nodeMap[validEdges[i].source];
        const ti = nodeMap[validEdges[i].target];
        if (si === undefined || ti === undefined) continue;

        const dx = nodeData[ti].x - nodeData[si].x;
        const dy = nodeData[ti].y - nodeData[si].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.01 * simulation.alpha;
        nodeData[si].vx += dx / dist * force;
        nodeData[si].vy += dy / dist * force;
        nodeData[ti].vx -= dx / dist * force;
        nodeData[ti].vy -= dy / dist * force;
      }

      for (let i = 0; i < nodeData.length; i++) {
        nodeData[i].vx *= simulation.velocityDecay;
        nodeData[i].vy *= simulation.velocityDecay;
        nodeData[i].x += nodeData[i].vx;
        nodeData[i].y += nodeData[i].vy;

        nodeData[i].x = Math.max(padding, Math.min(width - padding, nodeData[i].x));
        nodeData[i].y = Math.max(padding, Math.min(height - padding, nodeData[i].y));
      }

      updateVisuals();
      if (simulationRunning) {
        simulationTimer = setTimeout(simulateTick, 16);
      }
    }

    let svgNodes = [];
    let svgEdges = [];

    function createVisuals() {
      svgEdges = validEdges.map(function (e) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'graph-edge');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        gEdges.appendChild(line);
        return { el: line, data: e };
      });

      svgNodes = nodeData.map(function (n) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'graph-node');
        g.setAttribute('data-node-id', n.id);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'graph-node-circle');
        circle.setAttribute('r', n.radius);
        circle.setAttribute('fill', nodeColors[n.type] || '#6b7280');
        circle.setAttribute('stroke', 'var(--bg-card)');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'graph-node-label');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dy', n.radius + 14);
        label.textContent = n.label.length > 25 ? n.label.slice(0, 22) + '...' : n.label;
        g.appendChild(label);

        g.addEventListener('click', function () {
          highlightNode(n.id);
        });

        g.addEventListener('mouseenter', function (e) {
          showTooltip(e, n);
        });
        g.addEventListener('mouseleave', hideTooltip);

        gNodes.appendChild(g);
        return { el: g, data: n, circle: circle, label: label };
      });
    }

    function updateVisuals() {
      for (let i = 0; i < svgEdges.length; i++) {
        const si = nodeMap[svgEdges[i].data.source];
        const ti = nodeMap[svgEdges[i].data.target];
        if (si === undefined || ti === undefined) continue;
        svgEdges[i].el.setAttribute('x1', nodeData[si].x);
        svgEdges[i].el.setAttribute('y1', nodeData[si].y);
        svgEdges[i].el.setAttribute('x2', nodeData[ti].x);
        svgEdges[i].el.setAttribute('y2', nodeData[ti].y);
      }

      for (let i = 0; i < svgNodes.length; i++) {
        svgNodes[i].el.setAttribute('transform', 'translate(' + nodeData[i].x + ',' + nodeData[i].y + ')');
      }
    }

    let highlightedNodeId = null;

    function highlightNode(nodeId) {
      highlightedNodeId = nodeId;

      if (!nodeId) {
        svgNodes.forEach(function (sn) {
          sn.el.classList.remove('graph-node-dimmed', 'graph-node-highlighted');
        });
        svgEdges.forEach(function (se) {
          se.el.classList.remove('graph-edge-highlighted');
        });
        return;
      }

      const connected = new Set();
      connected.add(nodeId);

      validEdges.forEach(function (e) {
        if (e.source === nodeId) connected.add(e.target);
        if (e.target === nodeId) connected.add(e.source);
      });

      svgNodes.forEach(function (sn) {
        if (connected.has(sn.data.id)) {
          sn.el.classList.remove('graph-node-dimmed');
          sn.el.classList.add('graph-node-highlighted');
        } else {
          sn.el.classList.add('graph-node-dimmed');
          sn.el.classList.remove('graph-node-highlighted');
        }
      });

      svgEdges.forEach(function (se) {
        if (se.data.source === nodeId || se.data.target === nodeId) {
          se.el.classList.add('graph-edge-highlighted');
        } else {
          se.el.classList.remove('graph-edge-highlighted');
        }
      });
    }

    const tooltip = document.createElement('div');
    tooltip.setAttribute('class', 'graph-tooltip');
    container.appendChild(tooltip);

    function showTooltip(e, node) {
      const rect = container.getBoundingClientRect();
      tooltip.textContent = node.label + ' (' + node.type + ')';
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
    }

    let isPanning = false;
    let panStartX, panStartY;
    let panOffsetX = 0, panOffsetY = 0;
    let zoomScale = 1;

    container.addEventListener('mousedown', function (e) {
      if (e.target === container || e.target === svg) {
        isPanning = true;
        panStartX = e.clientX - panOffsetX;
        panStartY = e.clientY - panOffsetY;
      }
    });

    graphMouseMoveHandler = function (e) {
      if (isPanning) {
        panOffsetX = e.clientX - panStartX;
        panOffsetY = e.clientY - panStartY;
        svg.style.transform = 'translate(' + panOffsetX + 'px, ' + panOffsetY + 'px) scale(' + zoomScale + ')';
        svg.style.transformOrigin = 'center center';
      }
    };

    graphMouseUpHandler = function () {
      isPanning = false;
    };

    document.addEventListener('mousemove', graphMouseMoveHandler);
    document.addEventListener('mouseup', graphMouseUpHandler);

    container.addEventListener('wheel', function (e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomScale = Math.max(0.1, Math.min(5, zoomScale * delta));
      svg.style.transform = 'translate(' + panOffsetX + 'px, ' + panOffsetY + 'px) scale(' + zoomScale + ')';
      svg.style.transformOrigin = 'center center';
    }, { passive: false });

    container.addEventListener('dblclick', function () {
      zoomScale = 1;
      panOffsetX = 0;
      panOffsetY = 0;
      svg.style.transform = '';
      highlightNode(null);
    });

    createVisuals();
    simulateTick();

    var searchInput = getEl('graphSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        const q = this.value.toLowerCase();
        if (!q) {
          highlightNode(null);
          return;
        }

        let found = null;
        for (let i = 0; i < nodeData.length; i++) {
          if (nodeData[i].label.toLowerCase().includes(q)) {
            found = nodeData[i].id;
            break;
          }
        }
        if (found) highlightNode(found);
      });
    }
  }
})();

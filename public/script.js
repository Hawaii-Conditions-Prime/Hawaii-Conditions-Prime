document.addEventListener('DOMContentLoaded', function() {
      const carousel = document.querySelector('.carousel');
      const carouselContainer = document.querySelector('.carousel-container');

      if (!carousel || !carouselContainer) return;

      carousel.querySelectorAll(".clone").forEach(clone => clone.remove());

      const originalCards = Array.from(carousel.children);
      originalCards.forEach(card => {
          const clone = card.cloneNode(true);
          clone.classList.add("clone");
          carousel.appendChild(clone);
      });

      let scrollAmount = 0;
      let speed = 1.2;

      function animateScroll() {
          scrollAmount -= speed;
          if (scrollAmount <= -carousel.scrollWidth / 2) {
              scrollAmount = 0;
          }
          carousel.style.transform = `translateX(${scrollAmount}px)`;
          requestAnimationFrame(animateScroll);
      }

      animateScroll();

      carouselContainer.addEventListener('mouseenter', () => { speed = 0; });
      carouselContainer.addEventListener('mouseleave', () => { speed = 1.2; });
      window.addEventListener('resize', () => { scrollAmount = 0; });
  });

  // ── WebMCP — expose MCP tools to AI agents via the browser ───────────────────
  // https://webmachinelearning.github.io/webmcp/
  (function() {
      if (!('modelContext' in navigator)) return;
      try {
          const MCP_ENDPOINT = 'https://hawaii-conditions-prime.vercel.app/mcp';

          async function mcpCall(tool, args, apiKey) {
              const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
              if (apiKey) headers['X-MCP-Account'] = apiKey;
              const res = await fetch(MCP_ENDPOINT, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: tool, arguments: args }, id: Date.now() })
              });
              const text = await res.text();
              const parsed = text.startsWith('data:')
                  ? JSON.parse(text.split('\n').find(l => l.startsWith('data:')).replace('data:', '').trim())
                  : JSON.parse(text);
              const content = parsed?.result?.content?.[0]?.text;
              return content ? JSON.parse(content) : parsed;
          }

          const tools = [
              {
                  name: 'get_weather',
                  description: 'Get 5-day weather forecast, UV index, and wind for any Hawaiian island. Cost: $0.10.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string', enum: ['oahu', 'maui', 'big island', 'kauai', 'molokai', 'lanai'] } }, required: ['island'] },
                  execute: (args) => mcpCall('get_weather', args),
              },
              {
                  name: 'get_surf_conditions',
                  description: 'Get wave height, period, direction and 3-day surf forecast for any Hawaiian island. Cost: $0.10.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string', enum: ['oahu', 'maui', 'big island', 'kauai', 'molokai', 'lanai'] } }, required: ['island'] },
                  execute: (args) => mcpCall('get_surf_conditions', args),
              },
              {
                  name: 'get_ocean_safety',
                  description: 'Get box jellyfish warnings, rip currents, and NOAA alerts for Hawaiian beaches. Cost: $0.50.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string', enum: ['oahu', 'maui', 'big island', 'kauai', 'molokai', 'lanai'] } }, required: ['island'] },
                  execute: (args) => mcpCall('get_ocean_safety', args),
              },
              {
                  name: 'get_trail_status',
                  description: 'Get NPS alerts and state trail closures for Hawaii. Cost: $0.25.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string' }, trail_name: { type: 'string' } } },
                  execute: (args) => mcpCall('get_trail_status', args),
              },
              {
                  name: 'get_volcano_status',
                  description: "Get live Kilauea eruption status and USGS HVO alerts. Cost: $0.25.",
                  inputSchema: { type: 'object', properties: {} },
                  execute: (args) => mcpCall('get_volcano_status', args),
              },
              {
                  name: 'get_full_briefing',
                  description: 'Get a complete Hawaii conditions briefing — weather, surf, ocean safety, trails, and volcano in one call. Cost: $2.00.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string', enum: ['oahu', 'maui', 'big island', 'kauai', 'molokai', 'lanai'] }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['island'] },
                  execute: (args) => mcpCall('get_full_briefing', args),
              },
              {
                  name: 'search_restaurants',
                  description: 'Find restaurants in Hawaii by island, neighbourhood, cuisine, and price. Cost: $0.25.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string' }, neighborhood: { type: 'string' }, cuisine: { type: 'string' }, open_now: { type: 'boolean' } }, required: ['island'] },
                  execute: (args) => mcpCall('search_restaurants', args),
              },
              {
                  name: 'get_sun_times',
                  description: 'Get sunrise and sunset times for any Hawaiian island. Free.',
                  inputSchema: { type: 'object', properties: { island: { type: 'string' }, days: { type: 'number' } }, required: ['island'] },
                  execute: (args) => mcpCall('get_sun_times', args),
              },
          ];

          if (typeof navigator.modelContext.provideContext === 'function') {
              navigator.modelContext.provideContext({ tools });
          } else if (typeof navigator.modelContext.registerTools === 'function') {
              navigator.modelContext.registerTools(tools);
          }
      } catch (e) {
          // WebMCP not supported or errored — safe to ignore
      }
  })();
  
import 'mdui/mdui.css';
import 'mdui/components/top-app-bar.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/navigation-drawer.js';
import 'mdui/components/list.js';
import 'mdui/components/list-item.js';
import '@mdui/icons/menu.js';
import '@mdui/icons/construction.js';
import '@mdui/icons/bar-chart.js';
import '@mdui/icons/map.js';
import '@mdui/icons/settings.js';
import { Game } from './engine/Game';
import './ui/styles.css';

const app = document.getElementById('app')!;

app.innerHTML = `
  <mdui-navigation-drawer id="side-panel" close-on-overlay-click>
    <mdui-list>
      <mdui-list-item headline="Buildings">
        <mdui-icon-construction slot="icon"></mdui-icon-construction>
      </mdui-list-item>
      <mdui-list-item headline="Statistics">
        <mdui-icon-bar-chart slot="icon"></mdui-icon-bar-chart>
      </mdui-list-item>
      <mdui-list-item headline="Minimap">
        <mdui-icon-map slot="icon"></mdui-icon-map>
      </mdui-list-item>
      <mdui-list-item headline="Settings">
        <mdui-icon-settings slot="icon"></mdui-icon-settings>
      </mdui-list-item>
    </mdui-list>
  </mdui-navigation-drawer>

  <div id="main-content">
    <mdui-top-app-bar variant="small" id="app-bar">
      <mdui-button-icon id="menu-btn">
        <mdui-icon-menu></mdui-icon-menu>
      </mdui-button-icon>
      <span class="app-title">Feudal Realm Manager</span>
    </mdui-top-app-bar>
    <div id="game-container"></div>
  </div>
`;

// Side panel toggle
const menuBtn = document.getElementById('menu-btn')!;
const sidePanel = document.getElementById('side-panel') as HTMLElement & { open: boolean };
menuBtn.addEventListener('click', () => {
  sidePanel.open = !sidePanel.open;
});

// Game init
const container = document.getElementById('game-container')!;
const game = new Game(container);
game.start();

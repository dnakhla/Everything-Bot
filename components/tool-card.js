class ToolCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                    padding: 1.5rem;
                    border-radius: 0.75rem;
                    box-shadow: 
                        0 15px 30px rgba(0,0,0,0.12),
                        0 0 0 1px rgba(255, 255, 255, 0.1);
                    text-align: left;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    min-height: 140px;
                    opacity: 0;
                    transform: translateY(30px) scale(0.95);
                    backdrop-filter: blur(20px);
                    animation: toolCardAppear 0.6s ease-out forwards;
                }

                @keyframes toolCardAppear {
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                :host(:hover) {
                    transform: translateY(-8px) scale(1.03);
                    box-shadow: 
                        0 30px 60px rgba(0,0,0,0.25),
                        0 0 0 1px rgba(255, 255, 255, 0.2);
                }

                .tool-icon {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                    display: block;
                    color: #60a5fa;
                }

                h3 {
                    color: #60a5fa;
                    font-size: 1.1rem;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                    line-height: 1.2;
                }

                p {
                    font-size: 0.85rem;
                    color: #e2e8f0;
                    line-height: 1.4;
                    flex-grow: 1;
                }
            </style>
            <span class="tool-icon"><slot name="icon"></slot></span>
            <h3><slot name="title"></slot></h3>
            <p><slot name="description"></slot></p>
        `;
  }
}

customElements.define('tool-card', ToolCard);

class StepItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 1.5rem;
                    border-radius: 0.75rem;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.05);
                    text-align: left;
                    transition: transform 0.2s ease;
                    border: 1px solid #333;
                    margin-bottom: 1.5rem;
                }

                :host(:hover) {
                    transform: translateY(-0.3rem);
                }

                .step-number {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #007AFF;
                    margin-right: 1.5rem;
                    flex-shrink: 0;
                }

                h3 {
                    font-size: 1.3rem;
                    color: #E0E0E0;
                    margin-bottom: 0.5rem;
                }

                p {
                    font-size: 1rem;
                    color: #A0A0A0;
                }
            </style>
            <div class="step-number"><slot name="number"></slot></div>
            <div>
                <h3><slot name="title"></slot></h3>
                <p><slot name="description"></slot></p>
            </div>
        `;
  }
}

customElements.define('step-item', StepItem);

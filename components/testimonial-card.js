class TestimonialCard extends HTMLElement {
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
                    backdrop-filter: blur(20px);
                }

                blockquote {
                    margin: 0;
                    padding: 0;
                    border: 0;
                }

                p {
                    font-style: italic;
                    color: #e2e8f0;
                }

                footer {
                    margin-top: 1rem;
                    font-style: normal;
                    font-weight: 600;
                    color: #94a3b8;
                    background: none;
                    padding: 0;
                    text-align: left;
                }
            </style>
            <blockquote>
                <p><slot name="text"></slot></p>
                <footer><slot name="author"></slot></footer>
            </blockquote>
        `;
  }
}

customElements.define('testimonial-card', TestimonialCard);

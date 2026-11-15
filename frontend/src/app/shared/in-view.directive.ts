import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2, TemplateRef, ViewContainerRef } from "@angular/core";

/**
 * Builds its content only when it is about to be scrolled to, so a long page loads what is on screen first and the rest as the person reaches it (each
 * card asks the server for its own figures when it is built). Until then a placeholder of about the right height keeps the scrollbar honest.
 *
 *   <div *appInView> ... cards ... </div>
 *   <div *appInView="'20rem'"> ... </div>      a taller placeholder
 *
 * Where the browser cannot watch scrolling (no IntersectionObserver) the content is built at once, as before.
 */
@Directive({ selector: '[appInView]' })
export class InViewDirective implements OnInit, OnDestroy {
    /** the placeholder's height while the content is not built */
    @Input('appInView') height: string | '' = '';

    private holder?: HTMLElement;
    private observer?: IntersectionObserver;

    constructor(private tpl: TemplateRef<any>, private vcr: ViewContainerRef, private renderer: Renderer2, private host: ElementRef) {}

    ngOnInit() {
        if (typeof IntersectionObserver === 'undefined') { this.show(); return; }
        const anchor: Node = this.host.nativeElement;                    // the comment node this directive sits on
        const holder = this.renderer.createElement('div') as HTMLElement;
        this.renderer.setStyle(holder, 'min-height', this.height || '10rem');
        this.renderer.setAttribute(holder, 'aria-hidden', 'true');
        this.renderer.setAttribute(holder, 'data-lazy', 'waiting');
        this.renderer.insertBefore(anchor.parentNode, holder, anchor);
        this.holder = holder;
        // a generous margin: start a screenful before it is reached, so the figures are usually there by the time the eye is
        this.observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) this.show();
        }, { rootMargin: '600px 0px' });
        this.observer.observe(holder);
    }

    private show() {
        this.stop();
        this.vcr.clear();
        this.vcr.createEmbeddedView(this.tpl);
    }

    private stop() {
        this.observer?.disconnect();
        this.observer = undefined;
        if (this.holder && this.holder.parentNode) this.holder.parentNode.removeChild(this.holder);
        this.holder = undefined;
    }

    ngOnDestroy() { this.stop(); }
}

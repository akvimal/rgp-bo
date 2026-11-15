/**
 * A figure the server has shown from its kept copy while it works out a new one comes back marked `refreshing`. This asks for it again a few seconds later
 * (at most three times), so the page changes to the new figure by itself. Create one per card, call watch() with each reply, and stop() when the card goes.
 */
export class RefreshWatch {
    private timer: any = null;
    private tries = 0;

    watch(reply: any, reload: () => void) {
        this.stop();
        if (reply && reply.refreshing && this.tries++ < 3) this.timer = setTimeout(reload, 8000);
        else this.tries = 0;
    }

    stop() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}

declare const _default: (() => {
    url: string;
    type: string;
    host: string;
    port: number;
    password: string;
    name: string;
    username: string;
    synchronize: boolean;
    maxConnections: number;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    url: string;
    type: string;
    host: string;
    port: number;
    password: string;
    name: string;
    username: string;
    synchronize: boolean;
    maxConnections: number;
}>;
export default _default;

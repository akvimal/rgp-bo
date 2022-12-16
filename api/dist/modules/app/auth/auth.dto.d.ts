export declare class RegisterDto {
    readonly email: string;
    readonly password: string;
    readonly name?: string;
}
export declare class LoginDto {
    readonly email: string;
    readonly password: string;
}
export declare class ChangePasswordDto extends LoginDto {
    readonly newpassword: string;
}

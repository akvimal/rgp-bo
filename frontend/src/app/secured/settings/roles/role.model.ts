export interface Role {
    id?:number,
    name:string,
    permissions:any[],
    locked?:boolean
}
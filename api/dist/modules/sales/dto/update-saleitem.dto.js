"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSaleItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_saleitem_dto_1 = require("./create-saleitem.dto");
class UpdateSaleItemDto extends (0, swagger_1.PartialType)(create_saleitem_dto_1.CreateSaleItemDto) {
}
exports.UpdateSaleItemDto = UpdateSaleItemDto;
//# sourceMappingURL=update-saleitem.dto.js.map
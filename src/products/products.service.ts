import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma.service';
import { PaginationDto } from 'src/common';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProductsService {

  constructor(private readonly prisma: PrismaService) { }

  async create(createProductDto: CreateProductDto) {
    try {
      const product = await this.prisma.product.create({
        data: createProductDto,
      });
      return product;
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(error)
        throw new RpcException({
          message: `Unique constraint failed on the fields: ('name')`,
          status: HttpStatus.BAD_REQUEST
        });
      }
      throw new RpcException({
        message: `Internal Server Error`,
        status: HttpStatus.INTERNAL_SERVER_ERROR
      });
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;

    const totalPages = await this.prisma.product.count({ where: { available: true } });

    const products = await this.prisma.product.findMany({
      skip: (page! - 1) * limit!,
      take: limit,
      where: { available: true }
    });

    const lastPage = Math.ceil(totalPages / limit!);

    return {
      data: products,
      meta: {
        page: page,
        total: totalPages,
        lastPage: lastPage,
      },
    }

  }

  async findOne(id: number) {
    const product = await this.prisma.product.findFirst({ where: { id: id, available: true } });

    if (!product) {
      throw new RpcException({
        message: `Product with id #${id} not found`,
        status: HttpStatus.BAD_REQUEST
      });
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {

    const { id: __, ...data } = updateProductDto;

    await this.findOne(id);

    return await this.prisma.product.update({
      where: { id: id },
      data: data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // return this.prisma.product.delete({ where: { id: id } });
    const product = await this.prisma.product.update({
      where: { id: id },
      data: {
        available: false,
      }
    });

    return product;
  }

  async validateProducts(ids: number[]) {
    ids = Array.from(new Set(ids));
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    if (products.length !== ids.length) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Some products were not found'
      });
    }

    return products;
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardsModule } from '@cards/cards.module';
import { GameModule } from '@game/game.module';
import { PlayersModule } from '@players/players.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        return envValidationSchema.parse(config);
      },
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'toptrumps.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.DB_SYNCHRONIZE === 'true', // Controlado por env
      logging: process.env.DB_LOGGING === 'true', // Controlado por env
    }),
    CardsModule,
    GameModule,
    PlayersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

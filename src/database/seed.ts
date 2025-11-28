import { DataSource } from 'typeorm';
import { Card } from '@cards/entities/card.entity';
import { cardsSeedData } from './seeds/cards.seed';

const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'toptrumps.db',
  entities: [Card],
  synchronize: true,
});

async function seed() {
  try {
    console.warn('🌱 Iniciando seed de la base de datos...');

    await AppDataSource.initialize();
    console.warn('✅ Conexión a la base de datos establecida');

    const cardRepository = AppDataSource.getRepository(Card);

    // Limpiar datos existentes
    await cardRepository.clear();
    console.warn('🗑️  Datos anteriores eliminados');

    // Insertar cartas
    for (const cardData of cardsSeedData) {
      const card = cardRepository.create(cardData);
      await cardRepository.save(card);
    }

    console.warn(`✅ ${cardsSeedData.length} cartas insertadas correctamente`);
    console.warn('🎉 Seed completado exitosamente');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  }
}

void seed();

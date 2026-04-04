<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SchoolResource\Pages;
use App\Models\School;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class SchoolResource extends Resource
{
    protected static ?string $model = School::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-library';
    protected static ?string $navigationLabel = 'Sekolah';
    protected static ?string $modelLabel = 'Sekolah';
    protected static ?string $pluralModelLabel = 'Sekolah';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Data Sekolah')->schema([
                Forms\Components\TextInput::make('nama')->required()->maxLength(255),
                Forms\Components\TextInput::make('nsm')->label('NSM')->maxLength(255),
                Forms\Components\TextInput::make('npsn')->label('NPSN')->maxLength(255),
                Forms\Components\TextInput::make('npsm_nu')->label('NPSM NU')->maxLength(255),
                Forms\Components\Select::make('status')
                    ->label('Status Afiliasi')
                    ->options(['Jamaah' => 'Jamaah', 'Jamiyyah' => 'Jamiyyah']),
                Forms\Components\TextInput::make('akreditasi')->maxLength(255),
                Forms\Components\TextInput::make('kepala_madrasah')->label('Kepala Madrasah'),
                Forms\Components\TextInput::make('email')->email(),
                Forms\Components\TextInput::make('telepon'),
            ])->columns(2),

            Forms\Components\Section::make('Alamat')->schema([
                Forms\Components\Textarea::make('alamat')->rows(2),
                Forms\Components\TextInput::make('provinsi'),
                Forms\Components\TextInput::make('kabupaten'),
                Forms\Components\TextInput::make('kecamatan'),
                Forms\Components\TextInput::make('kelurahan'),
            ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('nama')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('nsm')->label('NSM')->searchable(),
                Tables\Columns\TextColumn::make('npsn')->label('NPSN')->searchable(),
                Tables\Columns\TextColumn::make('npsm_nu')->label('NPSM NU'),
                Tables\Columns\TextColumn::make('status')->label('Afiliasi')->badge()
                    ->color(fn(string $state): string => match($state) {
                        'Jamaah' => 'success',
                        'Jamiyyah' => 'info',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('kecamatan'),
                Tables\Columns\TextColumn::make('kepala_madrasah')->label('Kepsek'),
                Tables\Columns\TextColumn::make('teachers_count')->counts('teachers')->label('Guru'),
                Tables\Columns\TextColumn::make('students_count')->counts('students')->label('Siswa'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->label('Afiliasi')
                    ->options(['Jamaah' => 'Jamaah', 'Jamiyyah' => 'Jamiyyah']),
                Tables\Filters\SelectFilter::make('kecamatan')
                    ->options(fn() => School::distinct()->pluck('kecamatan', 'kecamatan')->filter()->toArray()),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('nama');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSchools::route('/'),
            'create' => Pages\CreateSchool::route('/create'),
            'edit' => Pages\EditSchool::route('/{record}/edit'),
        ];
    }
}

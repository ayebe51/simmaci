<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TeacherResource\Pages;
use App\Models\Teacher;
use App\Models\School;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class TeacherResource extends Resource
{
    protected static ?string $model = Teacher::class;
    protected static ?string $navigationIcon = 'heroicon-o-academic-cap';
    protected static ?string $navigationLabel = 'Guru';
    protected static ?string $modelLabel = 'Guru';
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Data Guru')->schema([
                Forms\Components\TextInput::make('nama')->required(),
                Forms\Components\TextInput::make('nuptk')->label('NUPTK'),
                Forms\Components\TextInput::make('nomor_induk_maarif')->label('NIM'),
                Forms\Components\TextInput::make('nip')->label('NIP'),
                Forms\Components\Select::make('jenis_kelamin')
                    ->options(['Laki-laki' => 'Laki-laki', 'Perempuan' => 'Perempuan']),
                Forms\Components\TextInput::make('tempat_lahir'),
                Forms\Components\TextInput::make('tanggal_lahir'),
                Forms\Components\TextInput::make('pendidikan_terakhir'),
                Forms\Components\TextInput::make('mapel')->label('Mata Pelajaran'),
                Forms\Components\Select::make('status')
                    ->options(['PNS' => 'PNS', 'GTY' => 'GTY', 'GTT' => 'GTT', 'Tendik' => 'Tendik']),
                Forms\Components\TextInput::make('tmt')->label('TMT'),
                Forms\Components\Toggle::make('is_certified')->label('Sertifikasi'),
            ])->columns(2),

            Forms\Components\Section::make('Unit & Kontak')->schema([
                Forms\Components\Select::make('school_id')->label('Sekolah')
                    ->relationship('school', 'nama')->searchable()->preload(),
                Forms\Components\TextInput::make('unit_kerja'),
                Forms\Components\TextInput::make('phone_number')->label('No. HP'),
                Forms\Components\TextInput::make('email')->email(),
                Forms\Components\TextInput::make('pdpkpnu')->label('PDPKPNU'),
                Forms\Components\TextInput::make('kta_number')->label('No. KTA'),
            ])->columns(2),

            Forms\Components\Section::make('Status')->schema([
                Forms\Components\Toggle::make('is_active')->label('Aktif')->default(true),
                Forms\Components\Toggle::make('is_verified')->label('Terverifikasi'),
                Forms\Components\Toggle::make('is_sk_generated')->label('SK Digenerate'),
            ])->columns(3),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('nama')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('nuptk')->label('NUPTK')->searchable(),
                Tables\Columns\TextColumn::make('nomor_induk_maarif')->label('NIM')->searchable(),
                Tables\Columns\TextColumn::make('unit_kerja')->searchable(),
                Tables\Columns\TextColumn::make('status')->badge()
                    ->color(fn(?string $state): string => match($state) {
                        'PNS' => 'success', 'GTY' => 'info', 'GTT' => 'warning', default => 'gray',
                    }),
                Tables\Columns\IconColumn::make('is_certified')->boolean()->label('Sertif'),
                Tables\Columns\IconColumn::make('is_active')->boolean()->label('Aktif'),
                Tables\Columns\IconColumn::make('is_verified')->boolean()->label('Valid'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['PNS' => 'PNS', 'GTY' => 'GTY', 'GTT' => 'GTT', 'Tendik' => 'Tendik']),
                Tables\Filters\TernaryFilter::make('is_active')->label('Aktif'),
                Tables\Filters\TernaryFilter::make('is_certified')->label('Sertifikasi'),
            ])
            ->actions([Tables\Actions\EditAction::make(), Tables\Actions\DeleteAction::make()])
            ->bulkActions([Tables\Actions\BulkActionGroup::make([Tables\Actions\DeleteBulkAction::make()])])
            ->defaultSort('nama');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTeachers::route('/'),
            'create' => Pages\CreateTeacher::route('/create'),
            'edit' => Pages\EditTeacher::route('/{record}/edit'),
        ];
    }
}

<?php

namespace App\Filament\Resources;

use App\Filament\Resources\StudentResource\Pages;
use App\Models\Student;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class StudentResource extends Resource
{
    protected static ?string $model = Student::class;
    protected static ?string $navigationIcon = 'heroicon-o-user-group';
    protected static ?string $navigationLabel = 'Siswa';
    protected static ?string $modelLabel = 'Siswa';
    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Data Siswa')->schema([
                Forms\Components\TextInput::make('nama')->required(),
                Forms\Components\TextInput::make('nisn')->label('NISN'),
                Forms\Components\TextInput::make('nik')->label('NIK'),
                Forms\Components\TextInput::make('nomor_induk_maarif')->label('NIM'),
                Forms\Components\Select::make('jenis_kelamin')
                    ->options(['Laki-laki' => 'Laki-laki', 'Perempuan' => 'Perempuan']),
                Forms\Components\TextInput::make('tempat_lahir'),
                Forms\Components\TextInput::make('tanggal_lahir'),
                Forms\Components\TextInput::make('kelas'),
                Forms\Components\Select::make('status')
                    ->options(['Aktif' => 'Aktif', 'Lulus' => 'Lulus', 'Keluar' => 'Keluar'])
                    ->default('Aktif'),
            ])->columns(2),

            Forms\Components\Section::make('Orang Tua')->schema([
                Forms\Components\TextInput::make('nama_ayah'),
                Forms\Components\TextInput::make('nama_ibu'),
                Forms\Components\TextInput::make('nama_wali'),
                Forms\Components\TextInput::make('nomor_telepon'),
            ])->columns(2),

            Forms\Components\Section::make('Sekolah & Alamat')->schema([
                Forms\Components\Select::make('school_id')->label('Sekolah')
                    ->relationship('school', 'nama')->searchable()->preload(),
                Forms\Components\TextInput::make('nama_sekolah'),
                Forms\Components\TextInput::make('npsn')->label('NPSN'),
                Forms\Components\Textarea::make('alamat')->rows(2),
            ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('nama')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('nisn')->label('NISN')->searchable(),
                Tables\Columns\TextColumn::make('nama_sekolah')->searchable(),
                Tables\Columns\TextColumn::make('kelas'),
                Tables\Columns\TextColumn::make('status')->badge()
                    ->color(fn(string $state): string => match($state) {
                        'Aktif' => 'success', 'Lulus' => 'info', 'Keluar' => 'danger', default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('jenis_kelamin')->label('JK'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['Aktif' => 'Aktif', 'Lulus' => 'Lulus', 'Keluar' => 'Keluar']),
            ])
            ->actions([Tables\Actions\EditAction::make(), Tables\Actions\DeleteAction::make()])
            ->bulkActions([Tables\Actions\BulkActionGroup::make([Tables\Actions\DeleteBulkAction::make()])])
            ->defaultSort('nama');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStudents::route('/'),
            'create' => Pages\CreateStudent::route('/create'),
            'edit' => Pages\EditStudent::route('/{record}/edit'),
        ];
    }
}
